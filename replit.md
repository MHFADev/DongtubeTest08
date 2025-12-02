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