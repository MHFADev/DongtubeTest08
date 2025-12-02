# 🚀 Panduan Deploy ke Vercel

Project ini sudah dioptimasi untuk deploy ke **Vercel Serverless**. Ikuti langkah berikut untuk deploy aplikasi Anda.

---

## 📋 Prasyarat

Sebelum deploy, pastikan Anda punya:
- ✅ Akun Vercel (gratis di [vercel.com](https://vercel.com))
- ✅ Repository GitHub/GitLab/Bitbucket
- ✅ Database PostgreSQL (lihat [Pilihan Database](#-pilihan-database))

---

## ⚡ Quick Deploy (3 Langkah)

### 1️⃣ Push Ke GitHub

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2️⃣ Import di Vercel

1. Login ke [vercel.com](https://vercel.com)
2. Klik **Add New** → **Project**
3. Import repository GitHub Anda
4. Vercel akan auto-detect konfigurasi ✅

### 3️⃣ Set Environment Variables

Di Vercel Dashboard → **Settings** → **Environment Variables**, tambahkan:

| Variable | Value | Deskripsi |
|----------|-------|-----------|
| `JWT_SECRET` | *generate secret* | Secret key untuk JWT authentication |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `NODE_ENV` | `production` | Environment mode |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Deploy!** Klik **Deploy** dan tunggu ~2-3 menit.

---

## 🗄️ Pilihan Database

Pilih salah satu provider PostgreSQL:

### Option 1: **Neon.tech** (Recommended) ⭐
- ✅ Free tier: 3 GB storage
- ✅ Serverless-friendly
- ✅ Auto-scaling

**Setup:**
1. Signup di [neon.tech](https://neon.tech)
2. Create project → Copy connection string
3. Paste ke Vercel environment variable `DATABASE_URL`

### Option 2: **Vercel Postgres**
- ✅ Terintegrasi langsung
- ✅ Auto-inject DATABASE_URL
- ⚠️ Free tier terbatas (256 MB)

**Setup:**
1. Di Vercel project → **Storage** tab
2. Create Database → **Postgres**
3. DATABASE_URL otomatis ditambahkan ✅

### Option 3: **Supabase**
- ✅ Free tier generous
- ✅ Banyak fitur tambahan

**Setup:**
1. Signup di [supabase.com](https://supabase.com)
2. Create project → Settings → Database
3. Copy **Connection Pooling** string (penting untuk serverless!)
4. Paste ke Vercel `DATABASE_URL`

**Format Connection String:**
```
postgresql://user:password@host:5432/database?sslmode=require
```

---

## ✅ Verifikasi Deployment

Setelah deploy berhasil, test endpoint berikut:

### 1. Health Check
```bash
curl https://your-app.vercel.app/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "uptime": 123,
  "timestamp": "2025-11-12T...",
  "environment": "vercel",
  "database": {
    "connected": true
  },
  "total_endpoints": 185
}
```

### 2. API Documentation
```
https://your-app.vercel.app/api/docs
```

### 3. Homepage
```
https://your-app.vercel.app/
```

---

## 🔧 Optimasi untuk Serverless

Project ini sudah dioptimasi dengan:
- ✅ **Stateless architecture** - tidak ada file system persistence
- ✅ **Database connection pooling** - max 2 connections untuk serverless
- ✅ **Static asset optimization** - serve via Vercel CDN
- ✅ **Cold start optimization** - initialization < 5 detik
- ✅ **SSL enabled** - secure database connections

### ⚠️ Fitur yang Disabled untuk Serverless

| Fitur | Status | Alasan |
|-------|--------|--------|
| **SSE (Server-Sent Events)** | ❌ Disabled | Tidak compatible dengan serverless |
| **Background Jobs** | ❌ Disabled | Serverless functions stateless |
| **File Watcher (hot-reload)** | ❌ Disabled | Development only |

> **Note:** Semua fitur API endpoint tetap berfungsi normal! Hanya real-time SSE yang disabled.

---

## 🐛 Troubleshooting

### Error: "Database connection failed"

**Solusi:**
1. Pastikan `DATABASE_URL` sudah di-set di Vercel
2. Pastikan connection string include `?sslmode=require`
3. Check database allow connections dari internet (not localhost only)
4. Test connection string locally:
   ```bash
   DATABASE_URL="postgresql://..." npm start
   ```

### Error: "JWT_SECRET is required"

**Solusi:**
1. Generate secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Add ke Vercel Environment Variables
3. **Redeploy** (penting!)

### Error: Function timeout / Cold start lambat

**Solusi:**
1. Ini normal untuk cold start pertama (2-5 detik)
2. Setelah warm, response time < 1 detik
3. Jika terus timeout, check database connection

### Static files (CSS/JS) tidak load

**Solusi:**
1. Pastikan files ada di folder `public/` atau `asset/`
2. Clear browser cache (Ctrl+Shift+R)
3. Check Vercel deployment logs

---

## 📊 Monitoring

### Vercel Dashboard Analytics
- **Request counts** - jumlah request per hari
- **Error rates** - persentase error
- **Function execution time** - performance metrics
- **Bandwidth usage** - data transfer

**Access:** Vercel Dashboard → Your Project → **Analytics** tab

### External Monitoring (Optional)

Setup monitoring gratis dengan:
- [UptimeRobot](https://uptimerobot.com) - Monitor `/health` endpoint
- [Sentry](https://sentry.io) - Error tracking
- [Better Uptime](https://betteruptime.com) - Status page

---

## 🔐 Security Checklist

Sebelum production:

- [ ] `JWT_SECRET` minimal 64 characters ✅
- [ ] Database connection uses SSL (`?sslmode=require`) ✅
- [ ] `.env` tidak di-commit ke Git ✅
- [ ] Strong database password (20+ characters)
- [ ] Environment variables di-set untuk Production, Preview, Development
- [ ] CORS configured properly (check vercel.json)

---

## 🚀 Deploy Updates

Setiap kali Anda push ke GitHub:
```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Vercel akan otomatis:
1. Detect changes ✅
2. Build & deploy ✅
3. Live dalam ~2 menit ✅

### Rollback ke Versi Sebelumnya

Di Vercel Dashboard:
1. **Deployments** tab
2. Pilih deployment yang ingin di-rollback
3. Klik **Promote to Production**

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Database Docs](https://neon.tech/docs)
- [Express on Vercel Guide](https://vercel.com/docs/frameworks/backend/express)

---

## 💡 Tips

1. **Environment Variables:** Gunakan Vercel Environment Variables, jangan hardcode
2. **Database Pooling:** Jangan ubah pool config di `config/database.js` (sudah optimized)
3. **Logs:** Check Vercel deployment logs untuk debug issues
4. **Performance:** First request (cold start) bisa lambat, subsequent requests cepat
5. **Static Assets:** Taruh di `public/` atau `asset/` untuk auto-CDN

---

## ✨ Done!

Aplikasi Anda sekarang live di:
```
https://your-app.vercel.app
```

Ada pertanyaan? Check:
- Vercel logs untuk error messages
- `/health` endpoint untuk status
- `/health/detailed` untuk detailed diagnostics

**Happy deploying! 🎉**
