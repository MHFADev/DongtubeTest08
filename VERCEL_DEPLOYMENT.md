# 🚀 Panduan Lengkap Deploy Dongtube API ke Vercel

## 📋 Daftar Isi
1. [Persiapan](#persiapan)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Setup Environment Variables](#setup-environment-variables)
4. [Langkah Deploy](#langkah-deploy)
5. [Database Setup](#database-setup)
6. [Post-Deployment Testing](#post-deployment-testing)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Performance Optimization](#performance-optimization)
10. [Security Best Practices](#security-best-practices)

---

## ⚙️ Persiapan

Project ini sudah dikonfigurasi secara lengkap untuk deployment di Vercel dengan konfigurasi production-ready.

### ✅ Fitur yang Sudah Dikonfigurasi

**Error Handling & Reliability:**
- ✅ Robust serverless function handler dengan comprehensive error handling
- ✅ Environment variable validation dengan safe fallbacks
- ✅ Database connection retry logic (3 attempts dengan exponential backoff)
- ✅ Request/response timeout protection (58s max)
- ✅ Graceful degradation saat database unavailable
- ✅ Cold start optimization dengan initialization caching

**Performance & Caching:**
- ✅ Edge caching untuk API responses (`s-maxage`, `stale-while-revalidate`)
- ✅ Static asset caching (1 year cache untuk images/css/js)
- ✅ Comprehensive security headers (XSS, CSP, CORS)
- ✅ .vercelignore untuk deployment size optimization
- ✅ Memory optimization (1024MB configured)

**Monitoring & Debugging:**
- ✅ Health check endpoints (`/health`, `/health/detailed`)
- ✅ Request logging dengan duration tracking
- ✅ Memory usage monitoring
- ✅ Database connection status reporting
- ✅ Initialization time tracking

**Application Features:**
- ✅ 185+ API endpoints (anime, social media, news, primbon, dll)
- ✅ JWT authentication dengan bcrypt password hashing
- ✅ Role-based access control (user, vip, admin)
- ✅ VIP endpoint protection dengan expiration validation
- ✅ Admin panel untuk endpoint management
- ✅ Server-Sent Events (SSE) untuk real-time updates

---

## 🔍 Pre-Deployment Checklist

Jalankan validasi otomatis sebelum deploy:

```bash
npm run validate
```

Atau cek manual:

### 1. ✅ Files & Configuration

- [ ] `api/index.js` - Serverless function handler
- [ ] `vercel.json` - Vercel configuration
- [ ] `package.json` - Dependencies & scripts
- [ ] `.env.example` - Environment variables template
- [ ] `.gitignore` - Contains `.env`, `node_modules/`, `.vercel/`
- [ ] `.vercelignore` - Excludes unnecessary files dari deployment

### 2. ✅ Environment Variables Prepared

- [ ] JWT_SECRET generated (minimal 64 karakter)
- [ ] DATABASE_URL siap (PostgreSQL connection string)
- [ ] ADMIN_WHATSAPP_NUMBER (optional, untuk VIP notifications)

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. ✅ Database Ready

- [ ] PostgreSQL database sudah dibuat
- [ ] Connection string tested locally
- [ ] Database accessible dari internet (tidak localhost only)
- [ ] SSL enabled (recommended: `?sslmode=require`)

### 4. ✅ Code Quality

- [ ] No `console.log` dengan sensitive data
- [ ] No hardcoded API keys atau passwords
- [ ] Error handling pada semua async operations
- [ ] .env tidak ter-commit ke Git

### 5. ✅ Testing Local

```bash
# Install dependencies
npm install

# Create .env dari .env.example
cp .env.example .env

# Edit .env dengan values yang benar
nano .env

# Test locally
npm start

# Test endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/docs
```

---

## 🔐 Setup Environment Variables

### Required Variables (WAJIB):

| Variable | Description | How to Get | Example |
|----------|-------------|------------|---------|
| `JWT_SECRET` | Secret key untuk JWT token signing | Generate dengan crypto | `bceb46bd7eaa9c68cb865ed242912bbab4fd5e2023f431ba5337f02d3d5b591943c883cdd607bcc912a7bc88a610794ff1853bb55ec3e5c5844afcf7796d4225` |
| `DATABASE_URL` | PostgreSQL connection string | Dari database provider | `postgresql://user:pass@host:5432/dbname?sslmode=require` |

### Optional Variables (Disarankan):

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `ADMIN_WHATSAPP_NUMBER` | - | Admin WhatsApp untuk VIP notifications |
| `DB_POOL_MAX` | `10` | Maximum database connections |
| `DB_POOL_MIN` | `2` | Minimum database connections |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

### Cara Menambahkan di Vercel:

**Via Dashboard (Recommended):**
1. Buka https://vercel.com/dashboard
2. Pilih project Anda
3. Klik **Settings** → **Environment Variables**
4. Add variable satu per satu:
   - Name: `JWT_SECRET`
   - Value: (paste generated secret)
   - Environment: ☑️ Production ☑️ Preview ☑️ Development
5. Klik **Save**
6. **PENTING**: Redeploy after menambahkan variables!

**Via CLI:**
```bash
# Set one variable
vercel env add JWT_SECRET production

# Pull env vars untuk local development
vercel env pull
```

---

## 📦 Langkah Deploy

### Method 1: Deploy via GitHub (Recommended)

**Keuntungan:**
- ✅ Auto-deployment setiap git push
- ✅ Preview deployment untuk setiap PR
- ✅ Rollback mudah ke commit sebelumnya
- ✅ CI/CD built-in

**Steps:**

1. **Push code ke GitHub:**
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

2. **Connect ke Vercel:**
   - Buka https://vercel.com/new
   - Klik **Import Git Repository**
   - Pilih repository Anda
   - Vercel akan auto-detect Express.js

3. **Configure Build Settings:**
   - Framework Preset: **Other**
   - Build Command: (kosongkan atau `npm install`)
   - Output Directory: (kosongkan)
   - Install Command: `npm install`

4. **Add Environment Variables:**
   - Klik **Environment Variables**
   - Add semua required variables
   - Pastikan apply ke: Production, Preview, Development

5. **Deploy:**
   - Klik **Deploy**
   - Tunggu ~2-5 menit
   - Vercel akan memberikan URL: `https://your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

**Untuk testing cepat atau manual deployment:**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login
vercel login

# Deploy ke preview (testing)
vercel

# Deploy ke production
vercel --prod

# Atau gunakan npm script
npm run deploy:preview   # Preview deployment
npm run deploy:prod      # Production deployment
```

**Deploy dengan environment variables via CLI:**
```bash
# Deploy dengan env vars
vercel --prod \
  -e JWT_SECRET="your-secret-here" \
  -e DATABASE_URL="postgresql://..." \
  -e NODE_ENV="production"
```

### Method 3: Deploy via Vercel Dashboard

1. Buka https://vercel.com/new
2. Tab **Import Project**
3. Upload folder project (zip file)
4. Configure settings
5. Deploy

---

## 🗄️ Database Setup

### Opsi 1: Vercel Postgres (Recommended untuk Vercel)

**Keuntungan:**
- ✅ Terintegrasi langsung dengan Vercel
- ✅ Auto-inject DATABASE_URL
- ✅ Pooling built-in
- ✅ Dashboard UI untuk management

**Setup:**
1. Di Vercel project dashboard → **Storage** tab
2. Klik **Create Database** → **Postgres**
3. Pilih region (recommended: sama dengan function region)
4. Database langsung ready, `DATABASE_URL` auto-added

**Limits (Free tier):**
- Max 60 hours compute/month
- 256 MB storage
- 256 MB data transfer

### Opsi 2: Neon.tech (Recommended untuk Free Tier)

**Keuntungan:**
- ✅ Generous free tier (3 GB storage, unlimited compute)
- ✅ Auto-scaling & branching
- ✅ Serverless-friendly

**Setup:**
1. Signup di https://neon.tech
2. Create new project
3. Copy connection string:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. Add ke Vercel environment variables

### Opsi 3: Supabase

**Setup:**
1. Signup di https://supabase.com
2. Create new project
3. Go to **Settings** → **Database**
4. Copy connection string (pooler mode untuk serverless):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

### Opsi 4: Railway / ElephantSQL

Sama seperti di atas, copy connection string dan add ke Vercel.

### ⚠️ Important Database Notes:

1. **SSL Required:** Pastikan connection string pakai `?sslmode=require`
2. **Connection Pooling:** Serverless functions butuh connection pooling
3. **IP Whitelist:** Pastikan database allow connections dari Vercel IPs (biasanya 0.0.0.0/0)
4. **Timezone:** Set UTC untuk consistency

### Database Migration

Database tables akan **auto-created** via Sequelize sync saat first deployment.

Jika ingin manual migration:
```bash
# Local
npm install
DATABASE_URL="your-url" npm start

# Sequelize akan create tables automatically
```

---

## ✅ Post-Deployment Testing

Setelah deploy, test endpoints berikut:

### 1. Health Check
```bash
# Basic health
curl https://your-project.vercel.app/health

# Expected response:
{
  "status": "healthy",
  "uptime": 123,
  "timestamp": "2025-11-11T10:00:00.000Z",
  "environment": "vercel",
  "total_endpoints": 185,
  "database": { "connected": true }
}
```

### 2. Detailed Health Check
```bash
curl https://your-project.vercel.app/health/detailed
```

### 3. API Version
```bash
curl https://your-project.vercel.app/api/version
```

### 4. API Documentation
```bash
curl https://your-project.vercel.app/api/docs
```

### 5. Test Authentication

**Signup:**
```bash
curl -X POST https://your-project.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

**Login:**
```bash
curl -X POST https://your-project.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

### 6. Test Static Files

Open browser:
- `https://your-project.vercel.app/` - Homepage
- `https://your-project.vercel.app/login.html` - Login page
- `https://your-project.vercel.app/admin-panel.html` - Admin panel

### 7. Performance Test
```bash
# Test response time
time curl https://your-project.vercel.app/health

# Load test (optional)
ab -n 100 -c 10 https://your-project.vercel.app/health
```

---

## 🔧 Troubleshooting

### Error: "This Serverless Function has crashed" (500 FUNCTION_INVOCATION_FAILED)

**Penyebab:**
1. ❌ Environment variables tidak di-set
2. ❌ DATABASE_URL invalid atau database down
3. ❌ JWT_SECRET missing
4. ❌ Module import error
5. ❌ Timeout (>60s)

**Solusi:**

1. **Check Logs:**
```bash
vercel logs your-deployment-url --follow
```

2. **Validate Environment Variables:**
   - Buka Vercel Dashboard → Settings → Environment Variables
   - Pastikan JWT_SECRET dan DATABASE_URL ada
   - **Redeploy** setelah menambahkan variables

3. **Test Health Endpoint:**
```bash
curl https://your-project.vercel.app/health
# Jika dapat response JSON → function berjalan
# Jika error 500 → check logs
```

4. **Check Function Logs di Vercel Dashboard:**
   - Deployments → Click deployment → Functions tab
   - Lihat error message lengkap

5. **Local Testing:**
```bash
# Test dengan env vars yang sama
JWT_SECRET="xxx" DATABASE_URL="xxx" npm start
```

### Error: "JWT_SECRET is required but not set"

**Solusi:**
1. Add JWT_SECRET di Vercel Environment Variables
2. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
3. Redeploy

### Error: "Database connection failed"

**Penyebab:**
- Invalid DATABASE_URL
- Database tidak accessible dari internet
- SSL certificate issue
- IP whitelist blocking Vercel

**Solusi:**
1. Test connection string locally
2. Pastikan database allow external connections
3. Add `?sslmode=require` ke connection string
4. Check database provider's IP whitelist (allow 0.0.0.0/0 atau Vercel IPs)

### Error: "Module not found"

**Penyebab:**
- Dependency tidak ter-install
- Import path salah
- File tidak ter-include dalam deployment

**Solusi:**
1. Check `package.json` - pastikan semua dependencies listed
2. Run `npm install` locally
3. Check vercel.json `includeFiles` config
4. Ensure `type: "module"` in package.json untuk ES6

### Error: "Function timeout"

**Penyebab:**
- Request terlalu lama (>60s pada config kita)
- Database query lambat
- External API call hang

**Solusi:**
1. Optimize slow queries
2. Add timeout ke external API calls
3. Consider increasing `maxDuration` (Pro plan: up to 300s)
4. Check `/health` untuk initialization time

### Error: 404 pada endpoint tertentu

**Solusi:**
1. Check `/debug/routes` untuk list semua routes
2. Pastikan route file di folder `routes/`
3. Pastikan route file export `default router`
4. Check logs untuk route loading errors

### Cold Start Lambat

**Normal:** First request bisa 2-5 detik (cold start)
**Too slow:** >10 detik → ada masalah

**Optimize:**
1. Reduce dependencies di `package.json`
2. Enable connection pooling
3. Use Vercel Pro (keeps functions warm)
4. Check initialization time di `/health`

---

## 📊 Monitoring & Maintenance

### 1. Vercel Dashboard Analytics

**Free tier includes:**
- Request counts
- Error rates
- Function execution time
- Bandwidth usage

**Access:**
- Dashboard → Your Project → Analytics tab

### 2. Health Check Monitoring

Setup external monitoring (recommended):
- **UptimeRobot** (free): https://uptimerobot.com
- **Better Uptime**: https://betteruptime.com
- **Pingdom**: https://pingdom.com

**Monitor endpoints:**
- `https://your-project.vercel.app/health` (every 5 min)
- Alert if status != 200 or `"status": "degraded"`

### 3. Database Monitoring

Check database metrics:
- Connection pool usage
- Query performance
- Storage usage

**Query slow queries:**
```sql
-- PostgreSQL slow query log
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 4. Error Tracking (Optional)

Integrate Sentry untuk error tracking:

1. Install:
```bash
npm install @sentry/node
```

2. Add ke `api/index.js`:
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || "development"
});
```

3. Add SENTRY_DSN ke environment variables

### 5. Log Management

**View logs:**
```bash
# Real-time logs
vercel logs --follow

# Filter by deployment
vercel logs <deployment-url>

# Filter by function
vercel logs --filter api/index.js
```

**Log retention:**
- Free: 1 day
- Pro: 7 days
- Enterprise: Custom

---

## ⚡ Performance Optimization

### 1. Caching Strategy

**Sudah dikonfigurasi di `vercel.json`:**

| Endpoint Type | Cache Strategy | TTL |
|---------------|----------------|-----|
| `/api/*` | Edge cache | 60s with stale-while-revalidate |
| Static files | Immutable cache | 1 year |
| `/health` | No cache | Always fresh |

**Custom caching per endpoint:**
```javascript
res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
```

### 2. Database Optimization

**Connection Pooling (sudah configured):**
```javascript
pool: {
  max: 10,       // Max connections
  min: 2,        // Min connections  
  acquire: 30000, // Max time to get connection
  idle: 10000    // Release idle connections
}
```

**Optimize queries:**
- Add indexes untuk frequently queried columns
- Use `attributes: [...]` untuk select specific columns only
- Paginate large result sets

### 3. Response Size Optimization

**Compress responses:**
```javascript
import compression from 'compression';
app.use(compression());
```

**Paginate large datasets:**
```javascript
const { page = 1, limit = 20 } = req.query;
const offset = (page - 1) * limit;

const results = await Model.findAll({
  limit: parseInt(limit),
  offset: parseInt(offset)
});
```

### 4. Function Size Optimization

**Reduce bundle size:**
- Remove unused dependencies
- Use `.vercelignore` (already configured)
- Tree-shake imports

**Current bundle:**
```bash
# Check bundle size
du -sh node_modules/
```

### 5. CDN & Edge Network

**Vercel Edge Network:**
- Automatic global CDN
- 100+ edge locations
- DDoS protection included

**No additional config needed** - already optimized via headers.

---

## 🔒 Security Best Practices

### 1. Environment Variables

- ✅ Never commit `.env` to Git
- ✅ Use strong JWT_SECRET (64+ characters)
- ✅ Rotate secrets periodically (every 6 months)
- ✅ Use different secrets untuk dev/staging/prod

### 2. Database Security

- ✅ Always use SSL (`?sslmode=require`)
- ✅ Strong database passwords (20+ characters)
- ✅ Limit database permissions (principle of least privilege)
- ✅ Regular backups (Vercel Postgres has auto-backups)

### 3. API Security (Already Implemented)

- ✅ JWT authentication
- ✅ bcrypt password hashing
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting per IP
- ✅ CORS configured properly
- ✅ Security headers (XSS, CSP, etc)

### 4. Additional Hardening (Optional)

**Add helmet.js:**
```bash
npm install helmet
```

```javascript
import helmet from 'helmet';
app.use(helmet());
```

**Add rate limiting per user:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

**Input validation:**
- Already using validation utils
- Validate all user inputs
- Sanitize HTML/SQL injection attempts

### 5. Monitoring Suspicious Activity

**Watch for:**
- Unusual spike in failed login attempts
- High rate of 404s (scanning attempts)
- Large payload uploads
- Unusual geographic access patterns

**Tools:**
- Vercel Firewall (Pro plan)
- Cloudflare (free CDN + WAF)

---

## 📚 Additional Resources

### Official Documentation
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Express.js on Vercel](https://vercel.com/docs/frameworks/backend/express)

### Database Providers
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Neon](https://neon.tech/docs)
- [Supabase](https://supabase.com/docs)
- [Railway](https://docs.railway.app)

### Monitoring & Tools
- [UptimeRobot](https://uptimerobot.com)
- [Sentry](https://sentry.io)
- [Better Uptime](https://betteruptime.com)

---

## 🎯 Quick Command Reference

```bash
# Validation
npm run validate                  # Run pre-deployment checks

# Local Development
npm install                      # Install dependencies
npm start                        # Start server (port 5000)
npm run dev                      # Start with hot-reload

# Deployment
vercel                           # Deploy to preview
vercel --prod                    # Deploy to production
npm run deploy:preview           # Deploy preview via npm
npm run deploy:prod              # Deploy prod via npm

# Environment Variables
vercel env pull                  # Pull env vars from Vercel
vercel env add NAME              # Add new env var
vercel env ls                    # List all env vars

# Logs & Debugging
vercel logs --follow             # Stream logs in real-time
vercel logs <deployment-url>     # View logs for specific deployment
vercel inspect <deployment-url>  # Inspect deployment details

# Database
DATABASE_URL="..." npm start     # Run with specific DB

# Secrets Generation
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # Generate JWT_SECRET
```

---

## ✅ Final Production Checklist

Sebelum go-live ke production, pastikan:

**Environment:**
- [ ] JWT_SECRET: Set ✅ (64+ characters)
- [ ] DATABASE_URL: Set ✅ (tested & working)
- [ ] NODE_ENV: `production` ✅
- [ ] ADMIN_WHATSAPP_NUMBER: Set ✅ (optional)

**Code Quality:**
- [ ] No console.log dengan sensitive data
- [ ] Error handling pada semua endpoints
- [ ] Input validation implemented
- [ ] SQL injection protection (via Sequelize ORM)
- [ ] XSS protection configured

**Testing:**
- [ ] `/health` returns 200 ✅
- [ ] `/health/detailed` shows all checks passing ✅
- [ ] Authentication working (signup/login) ✅
- [ ] VIP access control working ✅
- [ ] Static files serving correctly ✅
- [ ] Admin panel accessible ✅

**Security:**
- [ ] .env not committed to Git ✅
- [ ] .gitignore configured properly ✅
- [ ] CORS settings appropriate ✅
- [ ] Security headers configured ✅
- [ ] SSL enabled on database connection ✅

**Performance:**
- [ ] Caching configured ✅
- [ ] Database indexes added for common queries ✅
- [ ] Connection pooling configured ✅
- [ ] Response times < 1s for most endpoints ✅

**Monitoring:**
- [ ] External uptime monitoring setup (UptimeRobot, etc)
- [ ] Error tracking configured (Sentry, optional)
- [ ] Database monitoring enabled

**Documentation:**
- [ ] API documentation accessible (`/api/docs`)
- [ ] Team knows how to access Vercel dashboard
- [ ] Rollback procedure documented

---

## 🚨 Emergency Procedures

### Rollback to Previous Version

**Via Vercel Dashboard:**
1. Deployments tab
2. Click previous working deployment
3. Click **Promote to Production**

**Via CLI:**
```bash
vercel rollback
```

### Database Restore

**Vercel Postgres:**
- Dashboard → Storage → Postgres → Backups
- Select backup point → Restore

**External DB:**
- Follow provider's backup/restore procedure

### Emergency Contact

**Vercel Support:**
- Free tier: Community support (GitHub Discussions)
- Pro tier: Email support
- Enterprise: Priority support

---

## 📝 Notes

- **Default Region:** `iad1` (US East) - Configurable di vercel.json
- **Function Timeout:** 60 seconds (Pro: up to 300s)
- **Memory:** 1024 MB configured
- **Max Payload:** 5 MB (can increase dengan Pro plan)
- **Cold Start:** ~2-5 seconds (normal untuk serverless)

**Cost Estimation (Free Tier Limits):**
- Function executions: 100,000 / month
- Bandwidth: 100 GB / month
- Build time: 100 hours / month

Untuk traffic lebih tinggi, upgrade ke Pro plan.

---

**Last Updated:** November 2025
**Project Version:** 3.1.9
**Vercel API Version:** 2
