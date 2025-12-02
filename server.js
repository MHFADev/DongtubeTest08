import 'dotenv/config';
import express from "express";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import chokidar from "chokidar";
import { readFileSync } from "fs";
import { initDatabase, User } from "./models/index.js";
import { initEndpointDatabase, ApiEndpoint } from "./models/endpoint/index.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import sseRoutes from "./routes/sse.js";
import endpointsRoutes from "./routes/endpoints.js";
import adminEndpointsRoutes from "./routes/admin-endpoints.js";
import endpointsFromRoutesRoutes from "./routes/endpoints-from-routes.js";
import { checkVIPAccess, optionalAuth } from "./middleware/auth.js";
import RouteManager from "./services/RouteManager.js";
import EndpointSyncService from "./services/EndpointSyncService.js";

// Read package.json to get version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

if (!process.env.JWT_SECRET) {
  console.error(chalk.bgRed.white('\n ✗ FATAL: JWT_SECRET environment variable is required but not set! \n'));
  console.error(chalk.yellow('\n📝 Instructions to fix this:'));
  console.error(chalk.yellow('   1. Go to the "Secrets" tab in Replit (Tools > Secrets)'));
  console.error(chalk.yellow('   2. Add a new secret with key: JWT_SECRET'));
  console.error(chalk.yellow('   3. For the value, use a secure random string like:'));
  console.error(chalk.cyan('      bceb46bd7eaa9c68cb865ed242912bbab4fd5e2023f431ba5337f02d3d5b591943c883cdd607bcc912a7bc88a610794ff1853bb55ec3e5c5844afcf7796d4225'));
  console.error(chalk.yellow('\n   Or generate a new one with:'));
  console.error(chalk.cyan('      node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'));
  console.error(chalk.yellow('\n   4. Restart the Repl\n'));
  process.exit(1);
}

const app = express();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use('/asset', express.static(path.join(__dirname, "asset")));

// Cache
const cache = new Map();

// ==================== ROUTE MANAGER ====================
const routesPath = path.join(__dirname, "routes");
const routeManager = new RouteManager(routesPath);

// ==================== ENDPOINT SYNC SERVICE ====================
const endpointSyncService = new EndpointSyncService(routesPath);

app.use(optionalAuth);

// ==================== FILE WATCHER ====================
let debounceTimer = null;
const DEBOUNCE_DELAY = 500;

function startFileWatcher() {
  console.log(chalk.cyan('\n👁️  Starting file watcher for hot-reload...\n'));

  const watcher = chokidar.watch(routesPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher
    .on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.green(`\n📄 File added: ${path.basename(filePath)}`));
      scheduleReload('add', filePath);
    })
    .on('change', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.yellow(`\n📝 File changed: ${path.basename(filePath)}`));
      scheduleReload('change', filePath);
    })
    .on('unlink', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.red(`\n🗑️  File deleted: ${path.basename(filePath)}`));
      scheduleReload('unlink', filePath);
    })
    .on('error', (error) => {
      console.error(chalk.red('\n✗ File watcher error:'), error.message);
    })
    .on('ready', () => {
      console.log(chalk.green('✓ File watcher is ready and monitoring routes/\n'));
    });

  function scheduleReload(event, filePath) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      console.log(chalk.cyan(`\n⚡ Triggering hot-reload (event: ${event})...\n`));
      
      try {
        const result = await routeManager.reload();
        
        if (result.success) {
          console.log(chalk.bgGreen.black(`\n ✓ Hot-reload successful in ${result.duration}ms `));
          console.log(chalk.green(`   Total endpoints: ${result.totalEndpoints}\n`));
        } else if (result.skipped) {
          console.log(chalk.yellow('\n⏸️  Hot-reload skipped (already in progress)\n'));
        } else {
          console.log(chalk.bgRed.white('\n ✗ Hot-reload failed '));
          console.log(chalk.red(`   Error: ${result.error}\n`));
        }
      } catch (error) {
        console.error(chalk.red('\n✗ Hot-reload error:'), error.message);
      }
    }, DEBOUNCE_DELAY);
  }
}

// Export routeManager and endpointSyncService for admin endpoints
export { routeManager, endpointSyncService };

// ==================== START SERVER ====================
let isDatabaseConnected = false;

async function startServer() {
  try {
    // STEP 0: Initialize primary database
    console.log(chalk.cyan("🗄️  Initializing primary database...\n"));
    const dbInitialized = await initDatabase();
    
    if (!dbInitialized) {
      console.error(chalk.yellow("⚠️  Failed to initialize primary database. Running in degraded mode..."));
      console.log(chalk.yellow("   Some features requiring database will be unavailable.\n"));
      isDatabaseConnected = false;
    } else {
      console.log(chalk.green("✓ Primary database initialized\n"));
      isDatabaseConnected = true;
    }
    
    // STEP 0.5: Initialize endpoint database (second database) - only if primary DB is connected
    let endpointDbInitialized = false;
    if (isDatabaseConnected) {
      console.log(chalk.cyan("🗄️  Initializing endpoint database (Database #2)...\n"));
      endpointDbInitialized = await initEndpointDatabase();
      
      if (!endpointDbInitialized) {
        console.error(chalk.red("Failed to initialize endpoint database. Continuing with primary database only..."));
        console.log(chalk.yellow("⚠️  Endpoint management features will be disabled\n"));
      } else {
        console.log(chalk.green("✓ Endpoint database initialized\n"));
        
        // STEP 0.6: Schedule async sync (non-blocking)
        console.log(chalk.cyan("📅 Scheduled async endpoint sync after server start\n"));
        setTimeout(async () => {
          console.log(chalk.cyan("🔄 Starting background endpoint sync...\n"));
          await endpointSyncService.syncRoutesToDatabase();
          console.log(chalk.green("✓ Background endpoint sync completed\n"));
        }, 5000); // Sync 5 seconds after server starts
      }
    } else {
      console.log(chalk.yellow("⚠️  Skipping endpoint database (primary database not connected)\n"));
    }
    
    // STEP 1: Register auth and admin routes
    console.log(chalk.cyan("🔐 Registering authentication routes...\n"));
    app.use(authRoutes);
    app.use(adminRoutes);
    app.use(sseRoutes);
    app.use(endpointsFromRoutesRoutes);
    app.use(endpointsRoutes);
    app.use(adminEndpointsRoutes);
    console.log(chalk.green("✓ Auth & admin routes registered\n"));
    console.log(chalk.cyan("📡 SSE real-time updates enabled\n"));
    console.log(chalk.cyan("📊 Endpoint management routes enabled\n"));
    console.log(chalk.cyan("📁 Route-based endpoint loading enabled\n"));
    
    // STEP 2: Register core routes
    console.log(chalk.cyan("⚙️  Registering core routes...\n"));
    
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        total_endpoints: routeManager.getAllEndpoints().length,
        routeManager: routeManager.getStatus()
      });
    });

    // Version endpoint - returns version from package.json
    app.get("/api/version", (req, res) => {
      res.json({
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description
      });
    });

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.get("/api", (req, res) => {
      const allEndpoints = routeManager.getAllEndpoints();
      res.json({
        name: "Dongtube API Server",
        version: "2.0.0",
        total_endpoints: allEndpoints.length,
        endpoints: allEndpoints.map(e => ({
          name: e.name,
          path: e.path,
          method: e.method
        }))
      });
    });

    app.get("/api/docs", async (req, res) => {
      // Check user authentication and role
      let hasPremiumAccess = false;
      try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'email', 'role']
          });
          if (user && (user.role === 'vip' || user.role === 'admin')) {
            hasPremiumAccess = true;
          }
        }
      } catch (authError) {
        // User not authenticated or token invalid, keep hasPremiumAccess = false
      }
      
      try {
        // Query from SECOND DATABASE (endpoint database)
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
        
        // Map database endpoints to frontend format with VIP protection
        const endpointsWithVIPStatus = dbEndpoints.map(dbEp => {
          const isVIPEndpoint = dbEp.status === 'vip' || dbEp.status === 'premium';
          
          // Sanitize premium endpoint details for non-premium users
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
              placeholder: undefined,
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
        
        res.json({
          success: true,
          total: endpointsWithVIPStatus.length,
          endpoints: endpointsWithVIPStatus
        });
      } catch (error) {
        console.error('Error fetching endpoints from database:', error);
        
        // Fallback to RouteManager if endpoint database is not available
        const allEndpoints = routeManager.getAllEndpoints();
        
        // Even on error, treat all as free for safety
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
          fallback: true
        });
      }
    });

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
        routes: routes
      });
    });
    
    console.log(chalk.green("✓ Core routes registered\n"));
    
    // STEP 3: Apply VIP protection middleware (before loading routes)
    console.log(chalk.cyan("🔒 Applying VIP protection middleware...\n"));
    app.use(checkVIPAccess);
    console.log(chalk.green("✓ VIP middleware active\n"));
    
    // STEP 4: Mount dynamic router proxy
    console.log(chalk.cyan("🔧 Mounting dynamic route proxy...\n"));
    app.use((req, res, next) => {
      const activeRouter = routeManager.getActiveRouter();
      if (activeRouter) {
        activeRouter(req, res, next);
      } else {
        next();
      }
    });
    console.log(chalk.green("✓ Dynamic router proxy mounted\n"));
    
    // STEP 5: Register 404 handler (MUST BE LAST!)
    console.log(chalk.cyan("⚙️  Registering error handlers...\n"));
    
    // 404 handler - ALWAYS returns 200 status with error info in body
    app.use((req, res) => {
      res.status(200).json({
        success: false,
        error: "Endpoint not found",
        errorType: "NotFoundError",
        path: req.path,
        method: req.method,
        hint: "Visit /debug/routes to see all routes"
      });
    });

    // Global error handler - ALWAYS returns 200 status with error info in body
    app.use((err, req, res, next) => {
      console.error(chalk.red("Error:"), err.message);
      res.status(200).json({
        success: false,
        error: "Internal server error",
        errorType: err.name || "ServerError",
        details: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
    
    console.log(chalk.green("✓ Error handlers registered\n"));
    
    // STEP 6: Start listening FIRST (before route load)
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(chalk.bgGreen.black(`\n ✓ Server running on port ${PORT} `));
      console.log(chalk.cyan(`\n📚 Home: http://localhost:${PORT}`));
      console.log(chalk.cyan(`📚 API Docs: http://localhost:${PORT}/api/docs`));
      console.log(chalk.cyan(`📚 Debug: http://localhost:${PORT}/debug/routes`));
      console.log(chalk.yellow(`\n🔥 Test endpoint: http://localhost:${PORT}/api/test\n`));
      
      // STEP 6.5: Load routes asynchronously AFTER server is listening
      console.log(chalk.cyan("📦 Loading initial routes (async)...\n"));
      await routeManager.reload();
      console.log(chalk.green("✓ Initial routes loaded\n"));
      console.log(chalk.bgBlue.white(` ℹ Total endpoints: ${routeManager.getAllEndpoints().length} `));
      
      // STEP 6.6: Start file watcher for hot-reload
      startFileWatcher();
    });
    
  } catch (err) {
    console.error(chalk.bgRed.white(` Failed: ${err.message} `));
    process.exit(1);
  }
}

startServer();

export default app;