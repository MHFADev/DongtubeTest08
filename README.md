# 🚀 Dongtube API - Modular Architecture

API server dengan sistem **auto-load routes** yang modular dan scalable.

## 📁 Project Structure

```
project/
├── server.js                 # Main server (auto-load routes)
├── package.json
├── routes/                   # All API routes (auto-loaded)
│   ├── tiktok.js            # TikTok downloader
│   ├── youtube.js           # YouTube search & download
│   ├── spotify.js           # Spotify downloader
│   ├── instagram.js         # Instagram downloader
│   ├── facebook.js          # Facebook downloader
│   ├── anhmoe.js            # Anhmoe random images
│   ├── ideogram.js          # AI image generator
│   ├── image.js             # Image processing (removebg, ocr, screenshot)
│   ├── mal.js               # MyAnimeList API
│   ├── search.js            # Search engines (cookpad, lyrics)
│   ├── random.js            # Random images (ba, china)
│   └── news.js              # News API
├── utils/
│   ├── HTTPClient.js        # Reusable HTTP client with retry
│   └── validation.js        # Validation helpers
└── public/
    └── index.html           # API documentation frontend
```

## ✨ Features

### 🔄 Auto-Load System
- **Otomatis load semua routes** dari folder `routes/`
- **Tidak perlu edit server.js** saat tambah endpoint baru
- **Metadata otomatis** ter-collect untuk dokumentasi

### 📦 Modular Routes
Setiap route file harus export:
```javascript
// routes/example.js
import { Router } from "express";

const router = Router();

// Your endpoints here
router.get("/api/example", (req, res) => {
  res.json({ success: true });
});

// Metadata for auto-documentation
export const metadata = {
  name: "Example API",
  path: "/api/example",
  method: "GET",
  description: "Example endpoint",
  params: []
};

export default router;
```

### 🎯 How It Works

1. **Server starts** → Scan folder `routes/`
2. **Load all `.js` files** → Import as ES modules
3. **Register routes** → `app.use("/", route.default)`
4. **Collect metadata** → Build endpoints array
5. **Serve documentation** → `/api/docs` returns all endpoints

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install express axios cheerio uuid yt-search form-data chalk
```

### 2. Create Folders
```bash
mkdir routes utils public
```

### 3. Add Files
Copy semua artifacts ke folder yang sesuai:
- `server.js` → root
- `utils/HTTPClient.js` → utils folder
- `utils/validation.js` → utils folder
- `routes/tiktok.js` → routes folder
- `routes/youtube.js` → routes folder
- `routes/random.js` → routes folder
- `routes/spotify.js` → routes folder
- `index.html` → public folder

### 4. Run Server
```bash
node server.js
```

## ☁️ Deploy to Vercel

**Quick Deploy (5 menit):**

```bash
# 1. Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Deploy
vercel --prod
```

**Detailed Guides:**
- 🚀 **[Quick Start Guide](./QUICK_START.md)** - Deploy dalam 5 menit
- ✅ **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step checklist
- 📚 **[Full Documentation](./VERCEL_DEPLOYMENT.md)** - Comprehensive guide

**Requirements:**
- Environment Variables: `JWT_SECRET`, `DATABASE_URL`
- PostgreSQL Database (Vercel Postgres / Neon.tech / Supabase)

**After Deployment:**
- Health Check: `https://your-project.vercel.app/health`
- API Docs: `https://your-project.vercel.app/api/docs`

## ➕ Adding New Endpoints

### Example: Tambah Endpoint Instagram

1. **Create file** `routes/instagram.js`:
```javascript
import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

router.get("/api/instagram/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url, "instagram.com")) {
    return res.status(400).json({ 
      success: false, 
      error: "Invalid Instagram URL" 
    });
  }
  
  // Your logic here
  const encoded = encodeURIComponent(url);
  const response = await axios.get(`https://igram.website/content.php?url=${encoded}`, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    }
  });
  
  const json = response.data;
  const $ = cheerio.load(json.html);
  const thumb = $("img.w-100").attr("src");
  const download = $('a:contains("Download HD")').attr("href");
  
  res.json({
    success: true,
    data: { thumb, download }
  });
}));

router.post("/api/instagram/download", asyncHandler(async (req, res) => {
  // Same logic as GET
  const { url } = req.body;
  // ... your code
}));

export const metadata = {
  name: "Instagram Download",
  path: "/api/instagram/download",
  method: "GET, POST",
  description: "Download Instagram photos and videos",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.instagram.com/p/xxxxx",
      description: "Instagram post URL"
    }
  ]
};

export default router;
```

2. **Save file** → Server auto-load saat restart
3. **Done!** ✅ Endpoint langsung available di `/api/docs`

## 📝 Route Template

Copy template ini untuk endpoint baru:

```javascript
import { Router } from "express";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// GET endpoint
router.get("/api/your-path", asyncHandler(async (req, res) => {
  const { param1 } = req.query;
  
  // Your logic here
  
  res.json({ success: true, data: result });
}));

// POST endpoint
router.post("/api/your-path", asyncHandler(async (req, res) => {
  const { param1 } = req.body;
  
  // Your logic here
  
  res.json({ success: true, data: result });
}));

// Metadata for documentation
export const metadata = {
  name: "Your API Name",
  path: "/api/your-path",
  method: "GET, POST",
  description: "What does this endpoint do?",
  params: [
    {
      name: "param1",
      type: "text",
      required: true,
      placeholder: "example value",
      description: "Parameter description"
    }
  ]
};

export default router;
```

## 🔧 Utils Available

### HTTPClient
```javascript
import HTTPClient from "../utils/HTTPClient.js";

class MyAPI extends HTTPClient {
  constructor() {
    super("https://api.example.com", {
      timeout: 30000,
      headers: { "Custom-Header": "value" }
    });
  }
  
  async getData() {
    return await this.get("/endpoint");
  }
}
```

### Validation
```javascript
/**
 * Validation utilities for Dongtube API
 * Provides common validation functions and async error handler
 */

/**
 * Validation helper object
 */
export const validate = {
  /**
   * Check if string is not empty
   * @param {string} str - String to validate
   * @returns {boolean}
   */
  notEmpty(str) {
    return typeof str === 'string' && str.trim().length > 0;
  },

  /**
   * Check if valid URL
   * @param {string} url - URL to validate
   * @param {string} domain - Optional domain to check (e.g., "tiktok.com")
   * @returns {boolean}
   */
  url(url, domain = null) {
    if (!this.notEmpty(url)) return false;
    
    try {
      const parsed = new URL(url);
      
      // Check if domain matches (if provided)
      if (domain) {
        return parsed.hostname.includes(domain);
      }
      
      // Check if valid http/https URL
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Check if valid email
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  email(email) {
    if (!this.notEmpty(email)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Check if valid number
   * @param {any} num - Value to check
   * @param {number} min - Optional minimum value
   * @param {number} max - Optional maximum value
   * @returns {boolean}
   */
  number(num, min = null, max = null) {
    const parsed = Number(num);
    if (isNaN(parsed)) return false;
    
    if (min !== null && parsed < min) return false;
    if (max !== null && parsed > max) return false;
    
    return true;
  },

  /**
   * Check if valid array with items
   * @param {any} arr - Array to validate
   * @param {number} minLength - Optional minimum length
   * @returns {boolean}
   */
  array(arr, minLength = 1) {
    return Array.isArray(arr) && arr.length >= minLength;
  },

  /**
   * Check if valid object with keys
   * @param {any} obj - Object to validate
   * @returns {boolean}
   */
  object(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && Object.keys(obj).length > 0;
  },

  /**
   * Check if value is in allowed list
   * @param {any} value - Value to check
   * @param {Array} allowed - Array of allowed values
   * @returns {boolean}
   */
  inArray(value, allowed) {
    return allowed.includes(value);
  },

  /**
   * Validate multiple fields at once
   * @param {Object} data - Object with data to validate
   * @param {Object} rules - Validation rules
   * @returns {Object} { valid: boolean, errors: Array }
   * 
   * @example
   * validate.fields(
   *   { url: 'https://tiktok.com/video/123', count: '5' },
   *   {
   *     url: { required: true, type: 'url', domain: 'tiktok.com' },
   *     count: { required: false, type: 'number', min: 1, max: 10 }
   *   }
   * )
   */
  fields(data, rules) {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      // Check required
      if (rule.required && !this.notEmpty(value)) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if not required and empty
      if (!rule.required && !this.notEmpty(value)) {
        continue;
      }

      // Validate by type
      switch (rule.type) {
        case 'url':
          if (!this.url(value, rule.domain)) {
            errors.push(`${field} must be a valid URL${rule.domain ? ` from ${rule.domain}` : ''}`);
          }
          break;

        case 'email':
          if (!this.email(value)) {
            errors.push(`${field} must be a valid email`);
          }
          break;

        case 'number':
          if (!this.number(value, rule.min, rule.max)) {
            let msg = `${field} must be a valid number`;
            if (rule.min !== undefined && rule.max !== undefined) {
              msg += ` between ${rule.min} and ${rule.max}`;
            } else if (rule.min !== undefined) {
              msg += ` >= ${rule.min}`;
            } else if (rule.max !== undefined) {
              msg += ` <= ${rule.max}`;
            }
            errors.push(msg);
          }
          break;

        case 'array':
          if (!this.array(value, rule.minLength)) {
            errors.push(`${field} must be an array with at least ${rule.minLength || 1} items`);
          }
          break;

        case 'enum':
          if (!this.inArray(value, rule.values)) {
            errors.push(`${field} must be one of: ${rule.values.join(', ')}`);
          }
          break;
      }

      // Custom validator
      if (rule.custom && typeof rule.custom === 'function') {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/api/test', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json({ success: true, data });
 * }));
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Async handler error:', error);
      
      // Send error response
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  };
};

/**
 * Create custom validation error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @returns {Error}
 */
export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

/**
 * Middleware to validate request params/body
 * @param {Object} rules - Validation rules
 * @param {string} source - Where to get data from ('query', 'body', 'params')
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/api/test', 
 *   validateRequest({
 *     url: { required: true, type: 'url' }
 *   }, 'query'),
 *   asyncHandler(async (req, res) => {
 *     // req.query.url is guaranteed to be valid here
 *   })
 * );
 */
export const validateRequest = (rules, source = 'query') => {
  return (req, res, next) => {
    const data = req[source];
    const result = validate.fields(data, rules);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }

    next();
  };
};

export default { validate, asyncHandler, ValidationError, validateRequest };
