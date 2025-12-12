# Overview

The Dongtube API is a modular Express.js server designed to unify access to various third-party content services. Its primary purpose is to provide a performant and user-friendly interface for diverse online content, with a focus on optimization for low-end devices. Key capabilities include media downloading from social platforms (TikTok, Instagram, YouTube, Facebook, Spotify), AI image generation, anime/manga site scraping, news aggregation, image processing, and traditional Indonesian fortune-telling (primbon) services. The project aims to offer a comprehensive content hub with a smooth user experience across different device capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Design Principles
-   **Single Database Architecture**: Utilizes a single PostgreSQL database for all data, including users, endpoints, VIP settings, and logs. Endpoint tables are synchronized from route files to the database at startup.
-   **Route-Based Endpoint Loading**: The frontend loads endpoint data directly from route files via a dedicated endpoint, with dynamic metadata enrichment from the database for status information (free/vip/premium/disabled). This hybrid approach ensures fresh data from source files and real-time VIP/Premium status.
-   **Real-Time Endpoint Updates**: Employs Server-Sent Events (SSE) to broadcast endpoint changes instantly to connected users, ensuring administrative modifications are reflected without page refreshes.
-   **Route Auto-Loading**: Dynamically discovers and registers route modules, promoting modularity.
-   **Hot-Reload System**: Detects changes in route files and reloads them without server restarts, leveraging a `RouteManager` service, Chokidar, and atomic router swapping for zero-downtime updates.
-   **Optimized for Low-End Devices**: Implements a 4-tier adaptive performance system to adjust animations, CSS effects, and resource loading based on device specifications (2-4GB RAM).
-   **Centralized HTTP Client**: Provides a reusable `HTTPClient` with automatic retry logic, consistent timeouts, and standard headers for reliable web scraping.
-   **Validation Layer**: A centralized utility for URL validation and empty string detection.
-   **Consistent Error Handling**: Uses an `asyncHandler` wrapper for uniform JSON error responses from asynchronous route handlers.
-   **Content Delivery Strategy**: Supports JSON, direct binary responses, and URL redirection.

## UI/UX & Frontend
-   **Adaptive Rendering**: Adjusts rendering settings for Three.js animations and CSS effects based on device performance tiers.
-   **Enhanced Media Preview System**: Features a glassmorphism UI with animated gradients, responsive grid layouts, custom audio player, image gallery, and fullscreen modal, including advanced media type detection.
-   **Accessibility**: Includes `prefers-reduced-motion` support.
-   **Social Media Integration**: Implements Open Graph, Twitter Card tags, and SEO meta tags.
-   **Complex VIP Modal System**: An interactive premium upgrade modal with animated icons, sparkle effects, gradient text, benefit lists, and a WhatsApp CTA button, all with a glassmorphism design and mobile responsiveness.
-   **Dynamic VIP Badges**: Interactive badges for VIP and Premium statuses with gradient colors, icons, glow pulse animations, rotating sparkles, and an onclick handler to show the VIP upgrade modal.
-   **Smart VIP Popup Logic**: Displays context-sensitive upgrade/renewal prompts based on user authentication and VIP status (unauthenticated, non-VIP, expired VIP).
-   **Tab-Aware Audio Control**: Background music pauses/resumes based on browser tab visibility.
-   **Powerful Admin Panel**: A full-featured interface for managing API endpoints, including CRUD operations, bulk actions, inline status toggling, filtering, and a statistics dashboard.

## Feature Specifications
-   **Database-Driven Endpoint Management**: All API endpoints are stored in the primary database with metadata and automatically synced from route files. The admin panel provides full CRUD operations with instant SSE broadcasts.
-   **Parameter Field Normalization**: Handles both `params` and `parameters` fields for backward compatibility, normalizing all endpoint metadata to use `parameters` for consistent UI display.
-   **Premium Route Management System**: Allows administrators to toggle VIP access for API endpoints via an admin panel with auto-registration, bulk operations, and real-time updates.
-   **VIP Access Protection**: Middleware validates VIP status, including role checking and expiration date, providing contextual error messages.
-   **Unrestricted Admin Control**: Admins bypass all VIP checks, can force-update user roles, perform bulk user updates, and grant permanent VIP access.
-   **Premium Content Security**: Backend sanitization prevents premium endpoint details from being sent to non-VIP users. Uses composite keys for method-specific access and JWT-based authentication for documentation.
-   **VIP Endpoint Cache System**: In-memory caching with automatic invalidation upon admin changes and debug logging.
-   **Caching Strategy**: Utilizes in-memory Map-based caching with TTL for specific data.
-   **Background Music**: Auto-plays background music with a visual vinyl disc animation and volume controls.
-   **Security**: Admin routes are protected by authentication, authorization middleware, JWT tokens, role-based access control (RBAC), and bcrypt password hashing.
-   **Email/Password Authentication**: Uses JWT tokens and bcrypt for authentication.
-   **Instant VIP Access System**: The `refresh-token` endpoint allows immediate access updates after role changes, with real-time database checks.
-   **Real-Time VIP Access System**: SSE broadcasts role changes instantly, featuring an EventEmitter-based pub/sub system, per-user SSE streams, and frontend token refresh.
-   **Indonesian Primbon Services**: Provides various traditional Indonesian fortune-telling services, supporting URL encoding and both GET/POST methods.
-   **Category-Based Endpoint Filtering**: Admin endpoint for filtering endpoints by category with pagination, protected by authentication.

## Module Organization
-   Routes are organized by function for modularity and maintainability.

# External Dependencies

## Core Framework
-   **Express.js**

## HTTP & Web Scraping
-   **axios**
-   **cheerio**
-   **needle**
-   **form-data**

## Media & Content
-   **yt-search**

## Utilities
-   **chalk**
-   **uuid**

## Third-Party Service Integrations
-   **Social Media Platforms**: TikTok (`tikwm.com`), Instagram (`igram.website`), Facebook (`a2zconverter.com`), Xiaohongshu/RedNote (`rednote-downloader.io`), Snackvideo.
-   **Image Processing**: `removebg.one`, `ihancer.com`, `texttoimage.org`.
-   **AI Generation**: Ideogram (via Firebase Cloud Functions `chatbotandroid-3894d.cloudfunctions.net`).
-   **Content Aggregation**: MyAnimeList, AniList GraphQL API, Anichin, Oploverz, Samehadaku.
-   **News Sources**: Tribunnews, Kompas, `justice.gov`.
-   **Indonesian Services**: Primbon.com.
-   **Other Services**: `waifu.pics`, `api.imgflip.com`, `lrclib.net`, Google Drive.

## Deployment
-   **Vercel** - Production-ready with serverless function handler in `api/index.js`.
-   **Node.js >= 18.0.0**

## Vercel Deployment Configuration (Dec 2024 - Major Refactor)

### vercel.json Configuration
-   Uses `rewrites` for API routing: `/api/:path*`, `/auth/:path*`, `/admin/:path*`, `/random/:path*`, `/maker/:path*`, `/ai/:path*`, `/health`, `/debug/:path*` → `/api/index.js`
-   Uses `routes` for static file serving from `/public` directory
-   Comprehensive CORS headers applied to all API paths

### api/index.js Serverless Handler
-   **Unified Handlers**: All endpoints use `app.all()` pattern to handle GET, POST, PUT, DELETE in single functions
-   **Fast Cold Start**: Database init uses 8s timeout per connection (16s max total) to fit within 55s Vercel limit
-   **Non-Blocking Init**: Database failures don't prevent app startup - runs in degraded mode
-   **Production CORS**: Allows requests from any origin with comprehensive headers
-   **Detailed Error Handling**: All errors include error IDs, timestamps, and structured responses
-   **Debug Endpoints**: `/debug/vercel`, `/debug/env`, `/debug/routes` for troubleshooting

### Environment Variables
-   **Required**: `JWT_SECRET` (auth will fail without it, but app starts in degraded mode)
-   **Database**: Either `DATABASE_URL` OR `PGHOST`+`PGDATABASE` (+ optional `PGUSER`, `PGPASSWORD`, `PGPORT`)

### Graceful Degradation
-   App runs without database, returning 503 for database-dependent endpoints (`/auth/*`, `/admin/*`, `/api/endpoints`)
-   Available endpoints without database: `/health`, `/api/version`, `/api/endpoints/from-routes`

### Serverless Optimizations
-   Connection pool: max 1, min 0, idle 0
-   SSL required for Neon/Supabase/Vercel Postgres
-   SSE routes gracefully handled via fallback endpoints (see below)

### SSE (Server-Sent Events) Handling
-   **Problem**: SSE requires persistent connections, which are not supported in serverless environments (Vercel)
-   **Solution**: Implemented smart SSE detection and fallback system
-   **Backend**: 
    -   Added `/api/sse/status` endpoint for frontend to check SSE availability
    -   SSE fallback endpoints (`/sse/endpoint-updates`, `/sse/role-updates`) only mounted in serverless mode
    -   Returns JSON response with `sse_supported: false` instead of 404 on Vercel
-   **Frontend**:
    -   `endpoint-loader.js` and `role-sync.js` check `/api/sse/status` before attempting SSE connection
    -   If SSE not supported, automatically falls back to polling via `/api/endpoints/version`
    -   Polling interval: 10 seconds
-   **Local Development**: Full SSE support works normally with real-time updates

# Recent Changes (Dec 2025)

## Unified Method Handling Refactor
-   **Pattern**: Routes now use `router.all()` with `unifiedHandler()` wrapper instead of separate `router.get()` and `router.post()` handlers
-   **Benefits**: Eliminates code duplication, consistent parameter extraction, and centralized error handling
-   **Implementation**: `unifiedHandler()` in `utils/validation.js` extracts params from `req.query` (GET) or `req.body` (POST) automatically
-   **Refactored Routes**: primbon.js, route_anime.js, route-facebook.js, route-instagram.js, route-ideogram.js, route-youtube.js, route_xiaohongshu.js, snackvideo_route.js, route_tiktok_search.js, wikipedia_only.js, route_story.js, route_maker.js, tools_route.js
-   **Binary Endpoints**: Work correctly - routes handle Content-Type headers directly before calling `res.end(buffer)`

## Database SSL Configuration
-   **Railway Support**: Added detection for Railway environment variables (`railway.app`, `railway.internal`, `RAILWAY_ENVIRONMENT`)
-   **SSL Bypass**: Configured `rejectUnauthorized: false` for Railway's self-signed certificates
-   **Location**: `config/database.js`