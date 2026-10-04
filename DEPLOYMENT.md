# 🚀 TelePhotos Cloud — Free Deployment Guide

This guide shows you how to deploy your personal cloud storage **100% FREE** using **Render** + **Neon PostgreSQL** + **Vercel / Render Static Site**.

---

## 🎯 What You Will Get (100% Free)
- **Forever Free Backend**: Node.js API hosted on [Render.com](https://render.com) (Free tier)
- **Forever Free Database**: Serverless PostgreSQL on [Neon.tech](https://neon.tech) (Free tier, never expires)
- **Forever Free Frontend**: Fast global CDN on [Vercel](https://vercel.com) or [Render](https://render.com)
- **Infinite Cloud Storage**: 100% free uncompressed storage directly in your private Telegram channel!
- **Password Protected**: Locked with master password `@9525`

---

## 📋 Credentials You Need (Pre-Filled)
Keep these values handy when setting environment variables on Render:

| Variable | Value | Description |
|---|---|---|
| `APP_PASSWORD` | `@9525` | Master password to unlock vault |
| `TELEGRAM_API_ID` | `39944245` | Telegram API ID |
| `TELEGRAM_API_HASH` | `96989c1b116db083ccfe5e3d6778920d` | Telegram API Hash |
| `TELEGRAM_BOT_TOKEN` | `8835309651:AAFcJhdoyjut3a7vy6331ibrj00_9cyVFTA` | Bot Token (@suraj_photos_bot) |
| `TELEGRAM_CHANNEL_ID` | `-1004233045765` | Private Channel ID |
| `TELEGRAM_SESSION_STRING` | *(Leave empty on fresh deploy)* | Server automatically generates session |
| `TELEGRAM_UPLOAD_WORKERS` | `1` | 1 worker prevents AUTH_KEY_DUPLICATED for bots |
| `NODE_ENV` | `production` | Production mode |

---

## 🛠️ Step 1: Create Free PostgreSQL Database (Takes 1 minute)

Because Render's free database expires after 30 days, we use **Neon.tech** which is **100% Free Forever** (stores thousands of file metadata rows since all media files live in Telegram anyway):

1. Go to **[Neon.tech](https://neon.tech)** and sign up (free with GitHub or Google).
2. Click **Create Project**, name it `telegram-drive`, and choose the closest region.
3. On the dashboard, copy the **Connection string**:
   ```text
   postgresql://neondb_owner:AbC123XyZ@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this connection string ready for Step 2 as `DATABASE_URL`)*.

---

## 🛠️ Step 2: Deploy Backend to Render (Free Web Service)

1. Push your project to a **GitHub repository** (can be Private or Public):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for TelePhotos deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/telegram-drive.git
   git push -u origin main
   ```
2. Go to **[Render.com](https://render.com)** and log in.
3. Click **New +** → **Web Service**.
4. Select **Build and deploy from a Git repository** and connect your `telegram-drive` repo.
5. Fill in the following settings:
   - **Name**: `telephotos-backend`
   - **Region**: (Choose closest to you or closest to Neon DB)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
6. Scroll down to **Environment Variables** and add:
   - `DATABASE_URL` = (Paste your Neon connection string from Step 1)
   - `TELEGRAM_API_ID` = `39944245`
   - `TELEGRAM_API_HASH` = `96989c1b116db083ccfe5e3d6778920d`
   - `TELEGRAM_BOT_TOKEN` = `8835309651:AAFcJhdoyjut3a7vy6331ibrj00_9cyVFTA`
   - `TELEGRAM_CHANNEL_ID` = `-1004233045765`
   - `TELEGRAM_SESSION_STRING` = *(Leave blank/empty on new deploy, the bot creates its own session)*
   - `TELEGRAM_UPLOAD_WORKERS` = `1`
   - `APP_PASSWORD` = `@9525`
   - `NODE_ENV` = `production`
7. Click **Deploy Web Service**!
8. When the deployment finishes, copy your live backend URL (e.g. `https://telephotos-backend.onrender.com`).

---

## 🛠️ Step 3: Deploy Frontend (100% Free on Render or Vercel)

You can deploy the frontend on either **Render** or **Vercel** (both 100% free).

### Option 3A: Deploy Frontend on Render (Free Static Site)
1. In Render dashboard, click **New +** → **Static Site**.
2. Connect your `telegram-drive` repo.
3. Settings:
   - **Name**: `telephotos-app`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL` = `https://telephotos-backend.onrender.com/api` *(use your actual backend URL from Step 2 followed by `/api`)*
5. Under **Redirects/Rewrites**, add:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
6. Click **Deploy Static Site**!

### Option 3B: Deploy Frontend on Vercel (Fastest Global CDN — 15 seconds)
1. Go to **[Vercel.com](https://vercel.com)** and click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `client`
   - In **Environment Variables**:
     - Key: `VITE_API_URL`
     - Value: `https://telephotos-backend.onrender.com/api`
4. Click **Deploy**!

---

## 🎉 Step 4: Access Your Cloud Drive!
1. Open your frontend URL (e.g., `https://telephotos-app.onrender.com` or `https://telegram-drive.vercel.app`).
2. Enter your master password **`@9525`** and click **Unlock Vault**.
3. You now have your personal infinite cloud storage live on the internet, accessible from your phone or any computer anywhere in the world!

---

## 💡 Notes on Render Free Tier
- **Cold Starts**: Render's free tier spins down the backend after 15 minutes of inactivity to save resources. When you open the app after some time, the first request may take ~30–40 seconds to wake up the server. Once awake, it runs at full speed.
- **Data Safety**: All your photos, videos, and files are stored safely and permanently in your private Telegram channel. Even if Render stops or you rebuild the server, all your files remain untouched and secure in Telegram.
