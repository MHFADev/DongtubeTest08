# 🚀 Quick Start - Deploy ke Vercel dalam 5 Menit

Panduan super cepat untuk deploy Dongtube API ke Vercel.

## ⚡ TL;DR - 3 Langkah Utama

```bash
# 1. Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Setup database di Neon.tech atau Vercel Postgres

# 3. Deploy
vercel --prod
# atau push ke GitHub dan import di vercel.com/new
```

---

## 📝 Step-by-Step

### 1️⃣ Generate JWT Secret (30 detik)

**Windows PowerShell / CMD:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Copy output** - Anda akan paste ini ke Vercel nanti.

Contoh output:
```
bceb46bd7eaa9c68cb865ed242912bbab4fd5e2023f431ba5337f02d3d5b591943c883cdd607bcc912a7bc88a610794ff1853bb55ec3e5c5844afcf7796d4225
```

---

### 2️⃣ Setup Database (2 menit)

**Pilih salah satu:**

#### Option A: Neon.tech (Free, Recommended)
1. Buka: https://neon.tech
2. Sign up (gratis)
3. Create new project
4. Copy **Connection string** yang muncul
5. Pastikan ada `?sslmode=require` di akhir URL

Format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

#### Option B: Vercel Postgres (Terintegrasi)
1. Nanti saat di Vercel Dashboard
2. Go to **Storage** tab → **Create Database** → **Postgres**
3. Selesai! (DATABASE_URL otomatis ter-inject)

---

### 3️⃣ Deploy ke Vercel (2 menit)

#### Via GitHub (Recommended)

**A. Push ke GitHub:**
```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

**B. Import di Vercel:**
1. Buka: https://vercel.com/new
2. **Import Git Repository** → Pilih repo Anda
3. Framework: **Other**
4. **Environment Variables** → Add:
   - `JWT_SECRET` = (paste dari step 1)
   - `DATABASE_URL` = (paste dari step 2, skip jika pakai Vercel Postgres)
5. Klik **Deploy**
6. ☕ Tunggu 2-3 menit

**C. Done!** URL Anda: `https://your-project.vercel.app`

---

#### Via CLI (Alternative)

```bash
# Install Vercel CLI (sekali saja)
npm install -g vercel

# Login
vercel login

# Add environment variables
vercel env add JWT_SECRET production
# Paste JWT secret dari step 1

vercel env add DATABASE_URL production
# Paste database URL dari step 2

# Deploy!
vercel --prod
```

---

## ✅ Verifikasi Deployment

### Test 1: Health Check
```bash
curl https://your-project.vercel.app/health
```

**Sukses jika:**
```json
{
  "status": "healthy",
  "database": { "connected": true }
}
```

### Test 2: Browser
Buka: `https://your-project.vercel.app/`

Harus muncul homepage.

### Test 3: API Docs
Buka: `https://your-project.vercel.app/api/docs`

Harus muncul list endpoints.

---

## 🆘 Troubleshooting Cepat

### ❌ Error: "Function crashed"
**Fix:**
1. Vercel Dashboard → Settings → Environment Variables
2. Pastikan `JWT_SECRET` dan `DATABASE_URL` ada
3. Deployments → Latest → **Redeploy**

### ❌ Health check returns "degraded"
**Fix:**
1. Check database connection string
2. Pastikan database allow external connections
3. Add `?sslmode=require` ke DATABASE_URL

### ❌ "JWT_SECRET is required"
**Fix:**
1. Add `JWT_SECRET` di Environment Variables
2. Redeploy

---

## 📚 Dokumentasi Lengkap

- **Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Full Guide**: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
- **Environment Variables**: [.env.example](./.env.example)

---

## 🎯 Next Steps Setelah Deploy

1. **Setup Monitoring**: UptimeRobot untuk monitor `/health` endpoint
2. **Test Authentication**: Signup/login via API
3. **Custom Domain**: Vercel Dashboard → Domains
4. **Analytics**: Vercel Dashboard → Analytics

---

**Selamat! 🎉 API Anda sudah live di Vercel!**
