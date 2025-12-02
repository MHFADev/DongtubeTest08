import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";

// ==================== CRITICAL: Environment Validation ====================
// Validate BEFORE any imports that might use these variables
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:', missingVars.join(', '));
  console.error('📝 Please set these variables in Vercel Project Settings → Environment Variables');
  console.error('🔗 Visit: https://vercel.com/docs/environment-variables');
  // Don't exit in serverless, just log and continue with degraded mode
}

// ==================== Safe Imports with Error Handling ====================
let initDatabase, User, initEndpointDatabase, ApiEndpoint;
let authRoutes, adminRoutes, endpointsRoutes;
let adminEndpointsRoutes, endpointsFromRoutesRoutes;
let checkVIPAccess, optionalAuth;
let RouteManager, EndpointSyncService;

try {
  const modelsImport = await import("../models/index.js");
  initDatabase = modelsImport.initDatabase;
  User = modelsImport.User;
  
  const endpointModelsImport = await import("../models/endpoint/index.js");
  initEndpointDatabase = endpointModelsImport.initEndpointDatabase;
  ApiEndpoint = endpointModelsImport.ApiEndpoint;
  
  authRoutes = (await import("../routes/auth.js")).default;
  adminRoutes = (await import("../routes/admin.js")).default;
  endpointsRoutes = (await import("../routes/endpoints.js")).default;
  adminEndpointsRoutes = (await import("../routes/admin-endpoints.js")).default;
  endpointsFromRoutesRoutes = (await import("../routes/endpoints-from-routes.js")).default;
  
  const authMiddleware = await import("../middleware/auth.js");
  checkVIPAccess = authMiddleware.checkVIPAccess;
  optionalAuth = authMiddleware.optionalAuth;
  
  RouteManager = (await import("../services/RouteManager.js")).default;
  EndpointSyncService = (await import("../services/EndpointSyncService.js")).default;
  
  console.log('✅ All modules imported successfully');
} catch (importError) {
  console.error('❌ CRITICAL: Module import failed:', importError.message);
  console.error('Stack trace:', importError.stack);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let packageJson;
try {
  packageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(`📦 Package: ${packageJson.name} v${packageJson.version}`);
} catch (err) {
  console.error('⚠️ Failed to read package.json:', err.message);
  packageJson = { name: 'dongtube-api', version: 'unknown', description: 'API Server' };
}

const app = express();

// ==================== Middleware ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// CORS with comprehensive headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Static files with error handling
try {
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use('/asset', express.static(path.join(__dirname, "..", "asset")));
  console.log('✅ Static file serving configured');
} catch (staticError) {
  console.error('⚠️ Failed to configure static files:', staticError.message);
}

const routesPath = path.join(__dirname, "..", "routes");
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let routeManager, endpointSyncService;
let cachedRouteMetadata = null;

async function loadRoutesMetadataOnce() {
  if (cachedRouteMetadata) {
    return cachedRouteMetadata;
  }
  
  const endpoints = [];
  
  try {
    const { readdirSync } = await import('fs');
    const routeFiles = readdirSync(routesPath).filter(file => file.endsWith('.js'));
    
    for (const file of routeFiles) {
      if (file === 'admin.js' || file === 'auth.js' || file === 'sse.js') {
        continue;
      }
      
      try {
        const routePath = path.join(routesPath, file);
        const route = await import(pathToFileURL(routePath).href);
        
        if (route.metadata) {
          const metadata = Array.isArray(route.metadata) ? route.metadata : [route.metadata];
          endpoints.push(...metadata);
        }
      } catch (error) {
        console.error(`⚠️ Failed to load ${file}:`, error.message);
      }
    }
    
    cachedRouteMetadata = endpoints;
    console.log(`✅ Loaded ${endpoints.length} route metadata entries (cached)`);
  } catch (error) {
    console.error('⚠️ Failed to load route metadata:', error.message);
  }
  
  return endpoints;
}

if (isServerless) {
  console.log('🔧 Serverless mode: Skipping RouteManager and EndpointSyncService (use static route loading)');
} else {
  try {
    if (RouteManager) {
      routeManager = new RouteManager(routesPath);
      console.log('✅ RouteManager initialized');
    }
    if (EndpointSyncService) {
      endpointSyncService = new EndpointSyncService(routesPath);
      console.log('✅ EndpointSyncService initialized');
    }
  } catch (serviceError) {
    console.error('⚠️ Failed to initialize services:', serviceError.message);
  }
}

// Optional auth middleware (will be conditionally mounted during init)

// ==================== Initialization State ====================
let isInitialized = false;
let initializationError = null;
let isDatabaseAvailable = false;
const initStartTime = Date.now();

// ==================== Helper: Promise with Timeout ====================
function promiseWithTimeout(promise, timeoutMs, errorMessage) {
  let timeoutHandle;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([
    promise.then(result => {
      clearTimeout(timeoutHandle);
      return result;
    }),
    timeoutPromise
  ]).catch(error => {
    clearTimeout(timeoutHandle);
    throw error;
  });
}

// ==================== Database Initialization with Retry ====================
async function initializeDatabaseWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database initialization attempt ${attempt}/${maxRetries}...`);
      
      if (initDatabase) {
        await promiseWithTimeout(
          initDatabase(),
          30000,
          'Database init timeout after 30s'
        );
        console.log('✅ Primary database initialized');
      }
      
      if (initEndpointDatabase) {
        await promiseWithTimeout(
          initEndpointDatabase(),
          30000,
          'Endpoint DB init timeout after 30s'
        );
        console.log('✅ Endpoint database initialized');
      }
      
      isDatabaseAvailable = true;
      return true;
    } catch (dbError) {
      console.error(`❌ Database init attempt ${attempt} failed:`, dbError.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Database initialization failed after ${maxRetries} attempts: ${dbError.message}`);
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  isDatabaseAvailable = false;
  return false;
}

// ==================== Application Initialization ====================
async function initializeApp() {
  if (isInitialized) {
    console.log('✅ App already initialized, skipping...');
    return;
  }
  
  console.log('🚀 Starting application initialization...');
  console.log('🌍 Environment:', process.env.VERCEL ? 'Vercel' : 'Local');
  console.log('📍 Region:', process.env.VERCEL_REGION || 'unknown');
  
  try {
    // Validate critical environment variables
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required but not set. Please configure it in Vercel Environment Variables.');
    }
    
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL not set. Some features may not work.');
    }
    
    // Initialize database with retry logic
    if (process.env.DATABASE_URL) {
      try {
        await initializeDatabaseWithRetry(3);
      } catch (dbError) {
        console.error('❌ Database initialization failed:', dbError.message);
        initializationError = dbError;
        isDatabaseAvailable = false;
        // Continue without database - degraded mode
      }
    } else {
      isDatabaseAvailable = false;
    }
    
    // Mount authentication middleware ONLY if database is available
    if (isDatabaseAvailable && optionalAuth) {
      app.use(optionalAuth);
      console.log('✅ Optional auth middleware mounted');
    } else {
      console.warn('⚠️ Skipping auth middleware (database unavailable)');
    }
    
    // Register routes with conditional loading based on database availability
    // Note: SSE routes are disabled for Vercel serverless compatibility
    const routes = [
      { name: 'auth', handler: authRoutes, requiresDB: true },
      { name: 'admin', handler: adminRoutes, requiresDB: true },
      { name: 'endpoints-from-routes', handler: endpointsFromRoutesRoutes, requiresDB: false },
      { name: 'endpoints', handler: endpointsRoutes, requiresDB: true },
      { name: 'admin-endpoints', handler: adminEndpointsRoutes, requiresDB: true }
    ];
    
    for (const route of routes) {
      try {
        // Skip database-dependent routes if database is unavailable
        if (route.requiresDB && !isDatabaseAvailable) {
          console.warn(`⚠️ Skipping ${route.name} (database unavailable)`);
          continue;
        }
        
        if (route.handler) {
          app.use(route.handler);
          console.log(`✅ Route registered: ${route.name}`);
        } else {
          console.warn(`⚠️ Route not available: ${route.name}`);
        }
      } catch (routeError) {
        console.error(`❌ Failed to register route ${route.name}:`, routeError.message);
      }
    }
    
    // Add degraded mode notification middleware
    if (!isDatabaseAvailable) {
      console.warn('⚠️ Running in DEGRADED MODE - database features disabled');
      
      // Add middleware to return 503 for database-dependent endpoints
      app.use((req, res, next) => {
        // Match both with and without trailing slashes, and nested paths
        const dbDependentPaths = [
          '/auth', '/auth/',
          '/admin', '/admin/',
          '/sse', '/sse/',
          '/api/endpoints'
        ];
        
        const isDependentPath = dbDependentPaths.some(basePath => {
          return req.path === basePath || req.path.startsWith(basePath + '/');
        });
        
        if (isDependentPath) {
          return res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            message: 'Database is currently unavailable. Please try again later.',
            degraded_mode: true,
            available_endpoints: ['/health', '/health/detailed', '/api/version', '/api/endpoints/from-routes'],
            note: 'SSE (real-time events) is disabled on Vercel serverless',
            timestamp: new Date().toISOString()
          });
        }
        next();
      });
    }
    
    // ==================== Core Endpoints ====================
    
    // Health check endpoint (always available)
    app.get("/health", async (req, res) => {
      const uptime = Math.floor(process.uptime());
      const endpoints = routeManager ? routeManager.getAllEndpoints() : await loadRoutesMetadataOnce();
      
      const health = {
        status: isInitialized ? "healthy" : "degraded",
        initialized: isInitialized,
        uptime: uptime,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? "vercel" : "local",
        region: process.env.VERCEL_REGION || "unknown",
        version: packageJson.version,
        node_version: process.version,
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
        },
        database: {
          connected: initializationError === null && !!process.env.DATABASE_URL,
          error: initializationError?.message || null
        },
        total_endpoints: endpoints.length,
        init_time_ms: Date.now() - initStartTime
      };
      
      res.status(isInitialized ? 200 : 503).json(health);
    });

    // Detailed health check
    app.get("/health/detailed", async (req, res) => {
      const endpoints = routeManager ? routeManager.getAllEndpoints() : await loadRoutesMetadataOnce();
      
      const checks = {
        env_vars: {
          jwt_secret: !!process.env.JWT_SECRET,
          database_url: !!process.env.DATABASE_URL,
          node_env: process.env.NODE_ENV || 'not set'
        },
        database: {
          available: !!initDatabase && !!User,
          connected: false,
          error: null
        },
        routes: {
          loaded: endpoints.length,
          manager_active: !!routeManager,
          serverless_mode: isServerless
        },
        services: {
          route_manager: !!routeManager,
          endpoint_sync: !!endpointSyncService
        }
      };
      
      // Test database connection
      if (User && !initializationError) {
        try {
          await User.count();
          checks.database.connected = true;
        } catch (err) {
          checks.database.error = err.message;
        }
      }
      
      const allHealthy = checks.env_vars.jwt_secret && 
                        checks.env_vars.database_url && 
                        checks.database.connected;
      
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? "healthy" : "degraded",
        checks,
        timestamp: new Date().toISOString()
      });
    });

    // Version endpoint
    app.get("/api/version", (req, res) => {
      res.json({
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        environment: process.env.VERCEL ? "production" : "development",
        node_version: process.version
      });
    });

    // Root endpoint
    app.get("/", (req, res) => {
      try {
        res.sendFile(path.join(__dirname, "..", "public", "index.html"));
      } catch (err) {
        res.status(200).json({
          name: packageJson.name,
          version: packageJson.version,
          status: "running",
          docs: "/api/docs",
          health: "/health"
        });
      }
    });

    // API info endpoint
    app.get("/api", async (req, res) => {
      const allEndpoints = routeManager ? routeManager.getAllEndpoints() : await loadRoutesMetadataOnce();
      res.json({
        name: "Dongtube API Server",
        version: packageJson.version,
        status: isInitialized ? "operational" : "degraded",
        total_endpoints: allEndpoints.length,
        endpoints: allEndpoints.slice(0, 10).map(e => ({
          name: e.name,
          path: e.path,
          method: e.method
        })),
        docs: "/api/docs"
      });
    });

    // API Documentation endpoint with auth
    app.get("/api/docs", async (req, res) => {
      let hasPremiumAccess = false;
      
      // Check user authentication
      try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token && process.env.JWT_SECRET && User) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'email', 'role']
          });
          if (user && (user.role === 'vip' || user.role === 'admin')) {
            hasPremiumAccess = true;
          }
        }
      } catch (authError) {
        console.log('Auth check failed:', authError.message);
      }
      
      try {
        // Try to fetch from database
        if (ApiEndpoint && !initializationError) {
          const dbEndpoints = await ApiEndpoint.findAll({
            where: { isActive: true },
            order: [['priority', 'DESC'], ['createdAt', 'ASC']],
            attributes: [
              'id', 'path', 'method', 'name', 'description', 'category',
              'status', 'parameters', 'examples', 'responseType', 'responseBinary',
              'priority', 'tags'
            ]
          });

          res.setHeader('Cache-Control', 'public, max-age=300');
          res.setHeader('ETag', `"endpoints-${dbEndpoints.length}"`);
          
          const endpointsWithVIPStatus = dbEndpoints.map(dbEp => {
            const isVIPEndpoint = dbEp.status === 'vip' || dbEp.status === 'premium';
            
            if (isVIPEndpoint && !hasPremiumAccess) {
              return {
                path: dbEp.path,
                method: dbEp.method,
                name: dbEp.name,
                description: 'Premium endpoint - VIP access required',
                category: dbEp.category,
                requiresVIP: true,
                params: [],
                parameters: [],
                examples: undefined,
                responseBinary: false
              };
            }
            
            return {
              path: dbEp.path,
              method: dbEp.method,
              name: dbEp.name,
              description: dbEp.description,
              category: dbEp.category,
              requiresVIP: isVIPEndpoint,
              params: dbEp.parameters || [],
              parameters: dbEp.parameters || [],
              examples: dbEp.examples,
              responseBinary: dbEp.responseBinary || false,
              tags: dbEp.tags || []
            };
          });
          
          return res.json({
            success: true,
            total: endpointsWithVIPStatus.length,
            endpoints: endpointsWithVIPStatus
          });
        }
      } catch (error) {
        console.error('Database fallback in /api/docs:', error.message);
      }
      
      // Fallback to route manager or static loader
      const allEndpoints = routeManager ? routeManager.getAllEndpoints() : await loadRoutesMetadataOnce();
      
      const sanitizedEndpoints = allEndpoints.map(ep => ({
        path: ep.path,
        method: ep.method,
        name: ep.name,
        description: ep.description || ep.name,
        category: ep.category,
        requiresVIP: false,
        params: hasPremiumAccess ? (ep.params || ep.parameters || []) : [],
        parameters: hasPremiumAccess ? (ep.parameters || ep.params || []) : [],
        examples: hasPremiumAccess ? ep.examples : undefined,
        responseBinary: ep.responseBinary || false
      }));
      
      res.json({
        success: true,
        total: sanitizedEndpoints.length,
        endpoints: sanitizedEndpoints,
        fallback: true,
        note: "Loaded from route files (database unavailable)"
      });
    });

    // Debug routes endpoint
    app.get("/debug/routes", (req, res) => {
      const routes = [];
      
      app._router.stack.forEach(middleware => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach(handler => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });
      
      res.json({
        total: routes.length,
        routes: routes,
        timestamp: new Date().toISOString()
      });
    });
    
    // Apply VIP access check middleware ONLY if database is available
    if (isDatabaseAvailable && checkVIPAccess) {
      app.use(checkVIPAccess);
      console.log('✅ VIP access middleware mounted');
    } else if (!isDatabaseAvailable) {
      console.warn('⚠️ Skipping VIP access middleware (database unavailable)');
    }
    
    // Apply dynamic routes from RouteManager (only in non-serverless mode)
    if (routeManager) {
      app.use((req, res, next) => {
        const activeRouter = routeManager.getActiveRouter();
        if (activeRouter) {
          activeRouter(req, res, next);
        } else {
          next();
        }
      });
    } else if (isServerless) {
      console.log('🔧 Serverless mode: Mounting routes statically...');
      
      try {
        const { readdirSync } = await import('fs');
        const routeFiles = readdirSync(routesPath).filter(file => 
          file.endsWith('.js') && 
          !['admin.js', 'auth.js', 'sse.js', 'endpoints.js', 'admin-endpoints.js', 'endpoints-from-routes.js', 'admin-tools.js'].includes(file)
        );
        
        for (const file of routeFiles) {
          try {
            const routePath = path.join(routesPath, file);
            const route = await import(pathToFileURL(routePath).href);
            
            if (route.default && typeof route.default === 'function') {
              app.use(route.default);
              console.log(`  ✅ Mounted ${file}`);
            } else {
              console.warn(`  ⚠️ ${file} has no default export or not a function`);
            }
          } catch (error) {
            console.error(`  ⚠️ Failed to mount ${file}:`, error.message);
          }
        }
        
        console.log(`✅ Serverless static routes mounted (${routeFiles.length} files)`);
      } catch (error) {
        console.error('⚠️ Failed to mount static routes:', error.message);
      }
    }
    
    // 404 Handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.path,
        method: req.method,
        hint: "Visit /api/docs to see all available endpoints",
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error("❌ Global Error Handler:", err.message);
      console.error("Stack:", err.stack);
      
      res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? err.message 
          : "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? err.stack 
          : undefined,
        timestamp: new Date().toISOString()
      });
    });
    
    // Reload routes if RouteManager available (not in serverless)
    if (routeManager) {
      try {
        await routeManager.reload();
        console.log('✅ Routes reloaded successfully');
      } catch (reloadError) {
        console.error('⚠️ Route reload failed:', reloadError.message);
      }
    } else if (isServerless) {
      console.log('🔧 Serverless mode: Skipping route reload (using static route loading)');
      await loadRoutesMetadataOnce();
    }
    
    isInitialized = true;
    const initDuration = Date.now() - initStartTime;
    console.log(`✅ Application initialized successfully in ${initDuration}ms`);
    
  } catch (err) {
    console.error(`❌ Initialization error: ${err.message}`);
    console.error('Stack trace:', err.stack);
    initializationError = err;
    
    // Still mark as initialized to prevent infinite retry
    isInitialized = true;
    
    throw err; // Re-throw to be caught by handler
  }
}

// ==================== Vercel Serverless Handler ====================
export default async function handler(req, res) {
  try {
    // Initialize app on first request (cold start)
    if (!isInitialized) {
      console.log('🌡️ Cold start detected, initializing...');
      
      try {
        await promiseWithTimeout(
          initializeApp(),
          55000,
          'Initialization timeout after 55s'
        );
      } catch (initError) {
        console.error('❌ Initialization failed:', initError.message);
        
        // Return error response instead of crashing
        return res.status(500).json({
          success: false,
          error: 'Server initialization failed',
          details: initError.message,
          hint: 'Please check Vercel logs and ensure all environment variables are set correctly',
          required_env_vars: REQUIRED_ENV_VARS,
          missing_vars: missingVars,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Handle request with timeout
    const requestPromise = new Promise((resolve, reject) => {
      app(req, res);
      res.on('finish', resolve);
      res.on('error', reject);
    });
    
    await promiseWithTimeout(
      requestPromise,
      58000,
      'Request timeout after 58s'
    );
    
  } catch (error) {
    console.error('❌ Handler error:', error.message);
    console.error('Stack:', error.stack);
    
    // Send error response if headers not sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Request processing failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}
