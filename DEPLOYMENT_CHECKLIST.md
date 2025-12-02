# ✅ Vercel Deployment Checklist

Panduan singkat untuk deploy Dongtube API ke Vercel dengan aman.

## 📋 Pre-Deployment (Persiapan)

### 1. Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
**Simpan output** - Anda akan membutuhkannya untuk environment variables.

### 2. Setup Database

Pilih salah satu provider dan siapkan PostgreSQL database:

**Option A: Vercel Postgres** (Recommended untuk integrasi mudah)
- Login ke Vercel Dashboard
- Pilih project → **Storage** tab → **Create Database** → **Postgres**
- Region: `iad1` (US East)
- `DATABASE_URL` akan otomatis ter-inject ✅

**Option B: Neon.tech** (Recommended untuk free tier)
- Signup: https://neon.tech
- Create new project
- Copy connection string (format: `postgresql://user:pass@host/db?sslmode=require`)

**Option C: Supabase**
- Signup: https://supabase.com
- Create project → Settings → Database
- Copy **Connection Pooling** string (untuk serverless)

### 3. Validasi Lokal (Optional tapi Recommended)

```bash
# Install dependencies
npm install

# Test dengan env vars
JWT_SECRET="your-generated-secret" DATABASE_URL="your-db-url" npm start

# Test health endpoint
curl http://localhost:5000/health
```

---

## 🚀 Deployment Steps

### Method 1: Via GitHub (Recommended)

#### Step 1: Push ke GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

#### Step 2: Import di Vercel
1. Buka: https://vercel.com/new
2. Klik **Import Git Repository**
3. Pilih repository Anda
4. Configure:
   - Framework Preset: **Other**
   - Build Command: (kosongkan)
   - Output Directory: (kosongkan)
   - Install Command: `npm install`

#### Step 3: Add Environment Variables
Di Vercel import screen, klik **Environment Variables**:

| Name | Value | Environment |
|------|-------|-------------|
| `JWT_SECRET` | (paste generated secret dari step 1) | ☑️ Production ☑️ Preview ☑️ Development |
| `DATABASE_URL` | (paste connection string dari step 2) | ☑️ Production ☑️ Preview ☑️ Development |

> **PENTING**: Jika menggunakan Vercel Postgres, skip `DATABASE_URL` - akan otomatis ter-inject.

#### Step 4: Deploy
1. Klik **Deploy**
2. Tunggu ~2-5 menit
3. Vercel akan memberikan URL: `https://your-project.vercel.app`

---

### Method 2: Via Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Atau gunakan npm script
npm run deploy:prod
```

**Add environment variables via CLI:**
```bash
vercel env add JWT_SECRET production
# Paste your JWT secret when prompted

vercel env add DATABASE_URL production
# Paste your database URL when prompted
```

---

## ✅ Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-project.vercel.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "initialized": true,
  "environment": "vercel",
  "database": {
    "connected": true
  },
  "total_endpoints": 185
}
```

✅ **SUKSES** jika `status: "healthy"` dan `database.connected: true`  
❌ **GAGAL** jika `status: "degraded"` atau ada error

### 2. API Documentation
```bash
curl https://your-project.vercel.app/api/docs
```
**Expected**: JSON dengan list endpoints

### 3. Test Authentication
```bash
# Signup
curl -X POST https://your-project.vercel.app/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Login
curl -X POST https://your-project.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```
**Expected**: JSON response dengan token

### 4. Browser Test
- Homepage: `https://your-project.vercel.app/`
- Login Page: `https://your-project.vercel.app/login.html`
- Admin Panel: `https://your-project.vercel.app/admin-panel.html`

---

## 🔧 Troubleshooting

### Error: "This Serverless Function has crashed" (500)

**Penyebab:**
- Environment variables tidak di-set
- Database connection gagal
- JWT_SECRET missing

**Solusi:**
1. Check environment variables di Vercel Dashboard → Settings → Environment Variables
2. Pastikan `JWT_SECRET` dan `DATABASE_URL` ada
3. **REDEPLOY** setelah menambahkan variables:
   - Dashboard → Deployments → Click latest → **Redeploy**

### Error: "JWT_SECRET is required"

**Solusi:**
1. Add `JWT_SECRET` di Vercel Environment Variables
2. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
3. Redeploy

### Error: "Database connection failed"

**Penyebab:**
- Invalid `DATABASE_URL`
- Database tidak accessible dari internet
- SSL certificate issue

**Solusi:**
1. Test connection string locally
2. Pastikan database allow external connections
3. Add `?sslmode=require` ke connection string
4. Check database provider's IP whitelist (allow `0.0.0.0/0`)

### Health Check Returns "degraded"

**Solusi:**
1. Check Vercel logs: Dashboard → Deployments → Functions tab
2. Atau via CLI: `vercel logs --follow`
3. Look for error messages
4. Fix environment variables atau database connection
5. Redeploy

---

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
vercel logs --follow

# Specific deployment
vercel logs <deployment-url>
```

### Setup Uptime Monitoring (Recommended)
- **UptimeRobot** (free): https://uptimerobot.com
- Monitor: `https://your-project.vercel.app/health` every 5 minutes
- Alert if status != 200

---

## 🎯 Success Criteria

✅ **Deployment BERHASIL jika:**
- [ ] `/health` returns `"status": "healthy"`
- [ ] `/api/docs` returns list endpoints
- [ ] Authentication (signup/login) berfungsi
- [ ] Static files dapat diakses
- [ ] Database connected: `true`

---

## 📚 Additional Resources

- **Full Documentation**: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- **Environment Variables Template**: [.env.example](./.env.example)
- **Vercel Docs**: https://vercel.com/docs/functions
- **Troubleshooting Guide**: [VERCEL_DEPLOYMENT.md#troubleshooting](./VERCEL_DEPLOYMENT.md#troubleshooting)

---

## 🆘 Need Help?

Jika masih ada error setelah mengikuti checklist ini:
1. Check Vercel logs untuk error message lengkap
2. Baca [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) untuk troubleshooting detail
3. Pastikan semua environment variables sudah di-set dengan benar
4. Redeploy setelah fix environment variables
