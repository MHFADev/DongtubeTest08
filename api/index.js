/**
 * ==================== VERCEL SERVERLESS API HANDLER ====================
 * Production-grade Express app for Vercel serverless deployment.
 * 
 * Key Features:
 * - Unified handler for all HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
 * - Comprehensive CORS support for any frontend origin
 * - Detailed error handling with structured responses
 * - Environment variable validation
 * - Database connection with retry logic
 * - Static and dynamic route loading for serverless
 * 
 * Author: Refactored for production deployment
 * Version: 4.0.0
 */

import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { readFileSync, existsSync, readdirSync } from "fs";

// Force bundler to include pg package (required by Sequelize)
import pg from 'pg';
const { Client } = pg;

// ==================== FILE PATH SETUP ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== ENVIRONMENT VALIDATION ====================
// Define required environment variables for production
const REQUIRED_ENV_VARS = ['JWT_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

// Check for database config (either DATABASE_URL or PG* env vars)
const hasDatabaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '';
const hasPgEnvVars = process.env.PGHOST && process.env.PGDATABASE;
const hasDatabaseConfig = hasDatabaseUrl || hasPgEnvVars;

// Log environment validation results
if (missingVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:', missingVars.join(', '));
  console.error('📝 Set these in Vercel Project Settings → Environment Variables');
  console.error('🔗 Docs: https://vercel.com/docs/environment-variables');
}

if (!hasDatabaseConfig) {
  console.warn('⚠️ WARNING: No database configuration detected.');
  console.warn('   Set DATABASE_URL or PGHOST/PGDATABASE environment variables.');
  console.warn('   Running in degraded mode without database features.');
}

// ==================== PACKAGE.JSON LOADER ====================
let packageJson;
try {
  packageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(`📦 Loaded: ${packageJson.name} v${packageJson.version}`);
} catch (err) {
  console.error('⚠️ Failed to read package.json:', err.message);
  packageJson = { name: 'dongtube-api', version: 'unknown', description: 'API Server' };
}

// ==================== SAFE MODULE IMPORTS ====================
// Dynamic imports with error handling for serverless bundling compatibility
let initDatabase, User, initEndpointDatabase, ApiEndpoint;
let authRoutes, adminRoutes, endpointsRoutes;
let adminEndpointsRoutes, endpointsFromRoutesRoutes, adminToolsRoutes;
let checkVIPAccess, optionalAuth;
let RouteManager, EndpointSyncService;

try {
  // Core models
  const modelsImport = await import("../models/index.js");
  initDatabase = modelsImport.initDatabase;
  User = modelsImport.User;
  
  // Endpoint models
  const endpointModelsImport = await import("../models/endpoint/index.js");
  initEndpointDatabase = endpointModelsImport.initEndpointDatabase;
  ApiEndpoint = endpointModelsImport.ApiEndpoint;
  
  // Route modules
  authRoutes = (await import("../routes/auth.js")).default;
  adminRoutes = (await import("../routes/admin.js")).default;
  endpointsRoutes = (await import("../routes/endpoints.js")).default;
  adminEndpointsRoutes = (await import("../routes/admin-endpoints.js")).default;
  endpointsFromRoutesRoutes = (await import("../routes/endpoints-from-routes.js")).default;
  adminToolsRoutes = (await import("../routes/admin-tools.js")).default;
  
  // Middleware
  const authMiddleware = await import("../middleware/auth.js");
  checkVIPAccess = authMiddleware.checkVIPAccess;
  optionalAuth = authMiddleware.optionalAuth;
  
  // Services (non-critical, may fail in serverless)
  try {
    RouteManager = (await import("../services/RouteManager.js")).default;
    EndpointSyncService = (await import("../services/EndpointSyncService.js")).default;
  } catch (serviceErr) {
    console.warn('⚠️ Services not available:', serviceErr.message);
  }
  
  console.log('✅ All modules imported successfully');
} catch (importError) {
  console.error('❌ CRITICAL: Module import failed:', importError.message);
  console.error('Stack:', importError.stack);
}

// ==================== EXPRESS APP SETUP ====================
const app = express();

// ==================== PRODUCTION-GRADE CORS MIDDLEWARE ====================
// Allows requests from any frontend origin (important for Vercel deployment)
app.use((req, res, next) => {
  // Allow all origins for API access
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-Api-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours preflight cache
  res.header('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Limit');
  
  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ==================== BODY PARSERS ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// ==================== REQUEST LOGGING MIDDLEWARE ====================
// Logs all requests with timing information for debugging
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIcon = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    console.log(`${statusIcon} [${requestId}] ${req.method} ${req.path} → ${status} (${duration}ms)`);
  });
  
  // Attach request ID for error tracking
  req.requestId = requestId;
  next();
});

// ==================== STATIC FILE SERVING ====================
try {
  const publicPath = path.join(__dirname, "..", "public");
  const assetPath = path.join(__dirname, "..", "asset");
  
  if (existsSync(publicPath)) {
    app.use(express.static(publicPath, { maxAge: '1h' }));
    console.log('✅ Static files: /public');
  }
  
  if (existsSync(assetPath)) {
    app.use('/asset', express.static(assetPath, { maxAge: '1d' }));
    console.log('✅ Assets: /asset');
  }
} catch (staticError) {
  console.error('⚠️ Static file config failed:', staticError.message);
}

// ==================== INITIALIZATION STATE ====================
const routesPath = path.join(__dirname, "..", "routes");
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let isInitialized = false;
let initializationError = null;
let isDatabaseAvailable = false;
let cachedRouteMetadata = null;
const initStartTime = Date.now();

// ==================== UTILITY: PROMISE WITH TIMEOUT ====================
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

// ==================== ROUTE METADATA LOADER (SERVERLESS) ====================
// Loads endpoint metadata from route files for serverless environments
async function loadRoutesMetadataOnce() {
  if (cachedRouteMetadata && cachedRouteMetadata.length > 0) {
    console.log(`📦 Using cached metadata: ${cachedRouteMetadata.length} endpoints`);
    return cachedRouteMetadata;
  }
  
  const endpoints = [];
  const skipFiles = ['admin.js', 'auth.js', 'sse.js', 'endpoints.js', 'admin-endpoints.js', 'endpoints-from-routes.js', 'admin-tools.js'];
  
  try {
    if (!existsSync(routesPath)) {
      console.error(`❌ Routes path not found: ${routesPath}`);
      return endpoints;
    }
    
    const routeFiles = readdirSync(routesPath).filter(file => 
      file.endsWith('.js') && !skipFiles.includes(file)
    );
    
    console.log(`📂 Loading metadata from ${routeFiles.length} route files...`);
    
    for (const file of routeFiles) {
      try {
        const routePath = path.join(routesPath, file);
        const route = await import(pathToFileURL(routePath).href);
        
        if (route.metadata) {
          const metadata = Array.isArray(route.metadata) ? route.metadata : [route.metadata];
          
          // Handle comma-separated methods (GET, POST)
          for (const meta of metadata) {
            if (meta.method && meta.method.includes(',')) {
              const methods = meta.method.split(',').map(m => m.trim());
              for (const method of methods) {
                endpoints.push({ ...meta, method });
              }
            } else {
              endpoints.push(meta);
            }
          }
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to load ${file}:`, error.message);
      }
    }
    
    cachedRouteMetadata = endpoints;
    console.log(`✅ Loaded ${endpoints.length} endpoint metadata entries`);
  } catch (error) {
    console.error('❌ Metadata loading failed:', error.message);
  }
  
  return endpoints;
}

// ==================== DATABASE INITIALIZATION (FAST, NON-BLOCKING) ====================
// Optimized for serverless cold start - single attempt with short timeout
// Routes are mounted first, DB is optional for degraded mode
async function initializeDatabaseFast() {
  // Skip if no database config
  if (!hasDatabaseConfig) {
    console.warn('⚠️ No database config - skipping DB init');
    isDatabaseAvailable = false;
    return false;
  }
  
  try {
    console.log('🔄 Database init (fast mode)...');
    
    // Use shorter timeout for serverless (8s per DB, total 16s max)
    const DB_TIMEOUT = isServerless ? 8000 : 15000;
    
    if (initDatabase) {
      await promiseWithTimeout(initDatabase(), DB_TIMEOUT, `Primary DB timeout (${DB_TIMEOUT/1000}s)`);
      console.log('✅ Primary database connected');
    }
    
    if (initEndpointDatabase) {
      await promiseWithTimeout(initEndpointDatabase(), DB_TIMEOUT, `Endpoint DB timeout (${DB_TIMEOUT/1000}s)`);
      console.log('✅ Endpoint database connected');
    }
    
    isDatabaseAvailable = true;
    return true;
  } catch (dbError) {
    console.error('❌ Database init failed:', dbError.message);
    console.warn('⚠️ Continuing in degraded mode without database');
    isDatabaseAvailable = false;
    initializationError = dbError;
    return false;
  }
}

// ==================== MOUNT STATIC API ROUTES (SERVERLESS) ====================
async function mountStaticRoutes() {
  const skipFiles = ['admin.js', 'auth.js', 'sse.js', 'endpoints.js', 'admin-endpoints.js', 'endpoints-from-routes.js', 'admin-tools.js'];
  
  try {
    const routeFiles = readdirSync(routesPath).filter(file => 
      file.endsWith('.js') && !skipFiles.includes(file)
    );
    
    let mountedCount = 0;
    
    for (const file of routeFiles) {
      try {
        const routePath = path.join(routesPath, file);
        const route = await import(pathToFileURL(routePath).href);
        
        if (route.default && typeof route.default === 'function') {
          app.use(route.default);
          mountedCount++;
        }
      } catch (error) {
        console.warn(`  ⚠️ Mount failed: ${file} - ${error.message}`);
      }
    }
    
    console.log(`✅ Mounted ${mountedCount} route modules`);
  } catch (error) {
    console.error('❌ Route mounting failed:', error.message);
  }
}

// ==================== APPLICATION INITIALIZATION ====================
// Critical: This function MUST complete quickly for serverless cold start
// Routes are mounted FIRST, database is initialized AFTER (non-blocking approach)
async function initializeApp() {
  if (isInitialized) {
    return;
  }
  
  console.log('🚀 Initializing application...');
  console.log(`🌍 Environment: ${process.env.VERCEL ? 'Vercel' : 'Local'}`);
  console.log(`📍 Region: ${process.env.VERCEL_REGION || 'unknown'}`);
  console.log(`⏱️ Cold start at: ${new Date().toISOString()}`);
  
  // Validate JWT_SECRET - warn but don't throw to allow degraded operation
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET not set - auth features will fail');
    console.error('📝 Set JWT_SECRET in Vercel Environment Variables');
    // Don't throw - allow app to start in degraded mode
  }
  
  // Initialize database (fast, non-blocking, won't throw)
  await initializeDatabaseFast();
  
  try {
    // Mount optional auth middleware (if database available)
    if (isDatabaseAvailable && optionalAuth) {
      app.use(optionalAuth);
      console.log('✅ Auth middleware mounted');
    }
    
    // ==================== REGISTER CORE ROUTES ====================
    const routes = [
      { name: 'auth', handler: authRoutes, requiresDB: true },
      { name: 'admin', handler: adminRoutes, requiresDB: true },
      { name: 'admin-tools', handler: adminToolsRoutes, requiresDB: false },
      { name: 'endpoints-from-routes', handler: endpointsFromRoutesRoutes, requiresDB: false },
      { name: 'endpoints', handler: endpointsRoutes, requiresDB: true },
      { name: 'admin-endpoints', handler: adminEndpointsRoutes, requiresDB: true }
    ];
    
    for (const route of routes) {
      if (route.requiresDB && !isDatabaseAvailable) {
        console.warn(`⚠️ Skipping ${route.name} (no database)`);
        continue;
      }
      
      if (route.handler) {
        app.use(route.handler);
        console.log(`✅ Route: ${route.name}`);
      }
    }
    
    // ==================== DEGRADED MODE MIDDLEWARE ====================
    // Returns 503 for database-dependent endpoints when DB is unavailable
    if (!isDatabaseAvailable) {
      console.warn('⚠️ DEGRADED MODE - Database features disabled');
      
      app.use((req, res, next) => {
        const dbPaths = ['/auth/', '/admin/', '/sse/', '/api/endpoints'];
        const needsDB = dbPaths.some(p => req.path.startsWith(p) || req.path === p.slice(0, -1));
        
        if (needsDB) {
          return res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            message: 'Database is currently unavailable. Please try again later.',
            degraded_mode: true,
            available_endpoints: ['/health', '/api/version', '/api/endpoints/from-routes'],
            timestamp: new Date().toISOString()
          });
        }
        next();
      });
    }
    
    // ==================== UNIFIED HEALTH ENDPOINT (GET & POST) ====================
    // Handles both GET and POST methods in a single handler
    app.all("/health", async (req, res) => {
      // Unified handler for GET and POST
      const method = req.method;
      const endpoints = cachedRouteMetadata || await loadRoutesMetadataOnce();
      
      const health = {
        status: isInitialized ? "healthy" : "initializing",
        method: method,
        initialized: isInitialized,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? "vercel" : "local",
        region: process.env.VERCEL_REGION || "unknown",
        version: packageJson.version,
        node: process.version,
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        },
        database: {
          connected: isDatabaseAvailable,
          error: initializationError?.message || null
        },
        endpoints_count: endpoints.length,
        init_time_ms: Date.now() - initStartTime
      };
      
      // POST can include diagnostic data
      if (method === 'POST' && req.body?.diagnostic) {
        health.request_info = {
          headers: req.headers,
          body_size: JSON.stringify(req.body).length
        };
      }
      
      res.status(isInitialized ? 200 : 503).json(health);
    });

    // ==================== DETAILED HEALTH CHECK (GET & POST) ====================
    app.all("/health/detailed", async (req, res) => {
      const endpoints = cachedRouteMetadata || await loadRoutesMetadataOnce();
      
      const checks = {
        environment: {
          jwt_secret: !!process.env.JWT_SECRET,
          database_url: !!process.env.DATABASE_URL,
          pg_host: !!process.env.PGHOST,
          node_env: process.env.NODE_ENV || 'not set',
          vercel: !!process.env.VERCEL,
          region: process.env.VERCEL_REGION || 'unknown'
        },
        database: {
          configured: hasDatabaseConfig,
          available: isDatabaseAvailable,
          connected: false,
          error: initializationError?.message || null
        },
        routes: {
          loaded: endpoints.length,
          serverless_mode: isServerless,
          routes_path: routesPath,
          routes_exist: existsSync(routesPath)
        }
      };
      
      // Test database connection
      if (isDatabaseAvailable && User) {
        try {
          await User.count();
          checks.database.connected = true;
        } catch (err) {
          checks.database.error = err.message;
        }
      }
      
      const healthy = checks.environment.jwt_secret && checks.database.connected;
      
      res.status(healthy ? 200 : 503).json({
        status: healthy ? "healthy" : "degraded",
        checks,
        timestamp: new Date().toISOString()
      });
    });

    // ==================== VERSION ENDPOINT (GET & POST) ====================
    app.all("/api/version", (req, res) => {
      res.json({
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        environment: process.env.VERCEL ? "production" : "development",
        node: process.version,
        serverless: isServerless
      });
    });

    // ==================== ROOT ENDPOINT ====================
    app.get("/", (req, res) => {
      try {
        const indexPath = path.join(__dirname, "..", "public", "index.html");
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.json({
            name: packageJson.name,
            version: packageJson.version,
            status: "running",
            docs: "/api/docs",
            health: "/health"
          });
        }
      } catch (err) {
        res.json({
          name: packageJson.name,
          version: packageJson.version,
          status: "running"
        });
      }
    });

    // ==================== API INFO ENDPOINT (GET & POST) ====================
    app.all("/api", async (req, res) => {
      const endpoints = cachedRouteMetadata || await loadRoutesMetadataOnce();
      
      res.json({
        name: "Dongtube API Server",
        version: packageJson.version,
        status: isInitialized ? "operational" : "initializing",
        total_endpoints: endpoints.length,
        endpoints: endpoints.slice(0, 10).map(e => ({
          name: e.name,
          path: e.path,
          method: e.method
        })),
        docs: "/api/docs"
      });
    });

    // ==================== API DOCUMENTATION ENDPOINT (GET & POST) ====================
    app.all("/api/docs", async (req, res) => {
      let hasPremiumAccess = false;
      
      // Check authentication
      try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token && process.env.JWT_SECRET && User && isDatabaseAvailable) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findByPk(decoded.id, { attributes: ['id', 'email', 'role'] });
          if (user && ['vip', 'admin'].includes(user.role)) {
            hasPremiumAccess = true;
          }
        }
      } catch (authError) {
        // Not authenticated, continue with public access
      }
      
      // Try database first
      if (ApiEndpoint && isDatabaseAvailable) {
        try {
          const dbEndpoints = await ApiEndpoint.findAll({
            where: { isActive: true },
            order: [['priority', 'DESC'], ['createdAt', 'ASC']],
            attributes: ['id', 'path', 'method', 'name', 'description', 'category', 'status', 'parameters', 'examples', 'responseBinary', 'tags']
          });
          
          res.setHeader('Cache-Control', 'public, max-age=300');
          
          const endpoints = dbEndpoints.map(ep => {
            const isVIP = ['vip', 'premium'].includes(ep.status);
            
            if (isVIP && !hasPremiumAccess) {
              return {
                path: ep.path,
                method: ep.method,
                name: ep.name,
                description: 'Premium endpoint - VIP access required',
                category: ep.category,
                requiresVIP: true,
                params: [],
                responseBinary: false
              };
            }
            
            return {
              path: ep.path,
              method: ep.method,
              name: ep.name,
              description: ep.description,
              category: ep.category,
              requiresVIP: isVIP,
              params: ep.parameters || [],
              examples: ep.examples,
              responseBinary: ep.responseBinary || false,
              tags: ep.tags || []
            };
          });
          
          return res.json({
            success: true,
            total: endpoints.length,
            endpoints
          });
        } catch (dbError) {
          console.warn('DB fallback in /api/docs:', dbError.message);
        }
      }
      
      // Fallback to route metadata
      const endpoints = cachedRouteMetadata || await loadRoutesMetadataOnce();
      
      const sanitized = endpoints.map(ep => ({
        path: ep.path,
        method: ep.method,
        name: ep.name,
        description: ep.description || ep.name,
        category: ep.category || 'other',
        requiresVIP: false,
        params: hasPremiumAccess ? (ep.params || []) : [],
        responseBinary: ep.responseBinary || false
      }));
      
      res.json({
        success: true,
        total: sanitized.length,
        endpoints: sanitized,
        fallback: true,
        note: "Loaded from route files"
      });
    });

    // ==================== DEBUG ROUTES ENDPOINT ====================
    app.all("/debug/routes", (req, res) => {
      const routes = [];
      
      app._router?.stack?.forEach(middleware => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          middleware.handle?.stack?.forEach(handler => {
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
        routes,
        timestamp: new Date().toISOString()
      });
    });

    // ==================== DEBUG VERCEL ENVIRONMENT ====================
    app.all("/debug/vercel", async (req, res) => {
      let routeFilesInfo = [];
      let routesExist = false;
      
      try {
        routesExist = existsSync(routesPath);
        if (routesExist) {
          routeFilesInfo = readdirSync(routesPath).filter(f => f.endsWith('.js'));
        }
      } catch (e) {
        routeFilesInfo = [`Error: ${e.message}`];
      }
      
      const metadata = cachedRouteMetadata || await loadRoutesMetadataOnce();
      
      res.json({
        environment: {
          isServerless,
          nodeEnv: process.env.NODE_ENV,
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasPgHost: !!process.env.PGHOST,
          vercelEnv: process.env.VERCEL_ENV || 'not-vercel',
          region: process.env.VERCEL_REGION || 'unknown',
          dirname: __dirname
        },
        routes: {
          routesPath,
          exists: routesExist,
          files: routeFilesInfo.slice(0, 15),
          fileCount: routeFilesInfo.length,
          metadataCount: metadata.length
        },
        database: {
          configured: hasDatabaseConfig,
          available: isDatabaseAvailable,
          error: initializationError?.message || null
        },
        timestamp: new Date().toISOString()
      });
    });

    // ==================== DEBUG ENVIRONMENT VARIABLES ====================
    app.all("/debug/env", (req, res) => {
      // Only show non-sensitive env var status (not values)
      res.json({
        status: "ok",
        env_vars: {
          JWT_SECRET: !!process.env.JWT_SECRET,
          DATABASE_URL: !!process.env.DATABASE_URL,
          PGHOST: !!process.env.PGHOST,
          PGDATABASE: !!process.env.PGDATABASE,
          PGUSER: !!process.env.PGUSER,
          PGPASSWORD: !!process.env.PGPASSWORD,
          PGPORT: process.env.PGPORT || 'default',
          NODE_ENV: process.env.NODE_ENV || 'not set',
          VERCEL: !!process.env.VERCEL,
          VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
          VERCEL_REGION: process.env.VERCEL_REGION || 'not set'
        },
        hint: "Values are hidden for security. This shows which variables are set.",
        timestamp: new Date().toISOString()
      });
    });

    // ==================== VIP MIDDLEWARE (IF DATABASE AVAILABLE) ====================
    if (isDatabaseAvailable && checkVIPAccess) {
      app.use(checkVIPAccess);
      console.log('✅ VIP access middleware mounted');
    }

    // ==================== MOUNT DYNAMIC ROUTES (SERVERLESS) ====================
    if (isServerless) {
      console.log('🔧 Serverless mode: Mounting static routes...');
      await mountStaticRoutes();
    }

    // ==================== 404 HANDLER ====================
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.path,
        method: req.method,
        hint: "Visit /api/docs to see all available endpoints",
        debug: "/debug/routes",
        timestamp: new Date().toISOString()
      });
    });

    // ==================== GLOBAL ERROR HANDLER ====================
    // Production-grade error handling with detailed logging
    app.use((err, req, res, next) => {
      const errorId = req.requestId || Math.random().toString(36).substring(7);
      
      console.error(`❌ [${errorId}] Error:`, err.message);
      console.error(`   Path: ${req.method} ${req.path}`);
      console.error(`   Stack:`, err.stack);
      
      // Determine status code
      const status = err.status || err.statusCode || 500;
      
      // Build error response
      const errorResponse = {
        success: false,
        error: status === 500 ? "Internal server error" : err.message,
        error_id: errorId,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      };
      
      // Include stack trace in development
      if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV !== 'production') {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack?.split('\n').slice(0, 5);
      }
      
      res.status(status).json(errorResponse);
    });

    // Load route metadata
    await loadRoutesMetadataOnce();
    
    isInitialized = true;
    const duration = Date.now() - initStartTime;
    console.log(`✅ Application initialized in ${duration}ms`);
    
  } catch (err) {
    console.error(`❌ Initialization error: ${err.message}`);
    console.error('Stack:', err.stack);
    initializationError = err;
    isInitialized = true; // Prevent infinite retry
    throw err;
  }
}

// ==================== VERCEL SERVERLESS HANDLER ====================
// Main export for Vercel serverless deployment
export default async function handler(req, res) {
  try {
    // Cold start - initialize app on first request
    if (!isInitialized) {
      console.log('🌡️ Cold start detected...');
      
      try {
        await promiseWithTimeout(initializeApp(), 55000, 'Initialization timeout (55s)');
      } catch (initError) {
        console.error('❌ Init failed:', initError.message);
        
        return res.status(500).json({
          success: false,
          error: 'Server initialization failed',
          message: initError.message,
          hint: 'Check Vercel logs and ensure environment variables are set',
          required: REQUIRED_ENV_VARS,
          missing: missingVars,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Process request through Express
    return new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
      res.on('close', resolve);
      
      app(req, res);
    });
    
  } catch (error) {
    console.error('❌ Handler error:', error.message);
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Request processing failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export Express app for alternative usage
export { app };
