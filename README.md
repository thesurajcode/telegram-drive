# 🔒 TelePhotos Vault — Private Telegram Cloud Drive

[![Render Blueprint](https://img.shields.io/badge/Render-1--Click%20Deploy-46e3b7?logo=render&logoColor=white)](https://render.com)
[![Capacitor Android](https://img.shields.io/badge/Android-APK%20Ready-3DDC84?logo=android&logoColor=white)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: AES-256](https://img.shields.io/badge/Security-256--bit%20Encrypted-indigo.svg)](https://telegram.org)

> **TelePhotos** is a sleek, ultra-fast, and private personal cloud drive powered by your own Telegram MTProto storage. Store, stream, and manage your photos, 4K videos, audio, PDFs, and documents with unlimited cloud storage on your own private Telegram channel.

---

## 📋 Table of Contents
1. [✨ Features](#-features)
2. [🛡️ Security & Privacy Safety](#️-security--privacy-safety)
3. [⚖️ Legal Compliance & Fair Usage](#️-legal-compliance--fair-usage)
4. [🚀 Easiest 1-Click Deployment (Render)](#-easiest-1-click-deployment-render)
5. [📱 Android APK Installation](#-android-apk-installation)
6. [📦 GitHub Release Checklist (What to Upload)](#-github-release-checklist-what-to-upload)
7. [💻 Alternative Setup (Docker & Local)](#-alternative-setup-docker--local)
8. [⚙️ Configuration Environment Variables](#️-configuration-environment-variables)

---

## ✨ Features

- 📸 **Rich Media Lightbox & Gallery**: Instant preview for photos, video streaming with seek bar, audio player with visualizer, and in-app PDF document viewer.
- 🚀 **High-Speed MTProto Multi-Part Uploads**: Upload large files (up to 2GB each) directly to your private Telegram storage channel.
- 📱 **Mobile-First Experience & Android APK**: Built with Capacitor for native Android performance with safe-area notch avoidance, offline caching, and PWA installability.
- 🔐 **Vault Security**: Master password protection, Gmail OTP password recovery, rate-limited brute force protection, and remote session revocation.
- 📶 **Smart Offline Mode**: View cached photo libraries and media even without internet; auto-reconnects seamlessly once online.

---

## 🛡️ Security & Privacy Safety

Before deploying or sharing your repository, ensure your private credentials remain confidential:

- 🔒 **Zero Hardcoded Secrets**: This codebase contains no API tokens or passwords. All credentials are read strictly from environment variables or the Render secrets manager.
- 🚫 **Protected `.gitignore`**: Pre-configured to prevent `.env`, `.env.local`, SQLite databases, and Android build caches from ever being accidentally committed to GitHub.
- 🔑 **Private Channel Isolation**: All your files are stored inside your own personal private Telegram channel (`-100...`), accessible only to you and your bot token.

---

## ⚖️ Legal Compliance & Fair Usage

To ensure your deployment complies with Telegram's Terms of Service and local laws:

1. **Official MTProto & Bot API**: TelePhotos uses official GramJS / MTProto protocol libraries to interface with Telegram servers.
2. **Personal Storage Only**: Use your personal private Telegram channel as your private media backup vault. Do not host or distribute copyrighted, illicit, or pirated content.
3. **API Keys**: Obtain your own `API_ID` and `API_HASH` directly from [my.telegram.org](https://my.telegram.org) and never share them publicly.
4. **Rate Limits**: The backend is configured with automatic retry backoff to respect Telegram MTProto rate limits (`FLOOD_WAIT`).

---

## 🚀 Easiest 1-Click Deployment (Render)

Deploy both the **Backend API** and **Frontend Web App** in under 3 minutes with zero technical setup:

### Step 1: Push Repository to Your GitHub
1. Create a repository on [GitHub](https://github.com/new) (e.g. `telegram-drive`).
2. Push your code:
   ```bash
   git add .
   git commit -m "Initial commit of TelePhotos Vault"
   git push origin main
   ```

### Step 2: Launch Blueprint on Render
1. Open [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click **New +** $\rightarrow$ select **Blueprint**.
3. Connect your GitHub repository (`telegram-drive`).
4. Render will automatically detect the [`render.yaml`](render.yaml) file.

### Step 3: Enter Your Telegram Variables & Click Apply

Fill in the prompt with your values:

| Variable | Example Value | Where to Get It |
| :--- | :--- | :--- |
| **`TELEGRAM_API_ID`** | `29384756` | [my.telegram.org](https://my.telegram.org) $\rightarrow$ API development tools |
| **`TELEGRAM_API_HASH`** | `9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d` | [my.telegram.org](https://my.telegram.org) |
| **`TELEGRAM_BOT_TOKEN`** | `7123456789:AAHfk39_xK92jsdfk20-3k` | [@BotFather](https://t.me/BotFather) on Telegram |
| **`TELEGRAM_CHANNEL_ID`** | `-1001234567890` | Forward a channel post to [@userinfobot](https://t.me/userinfobot) |
| **`APP_PASSWORD`** | `MySecurePassword@2026` | Choose any password to unlock your vault |

Click **Apply**. Render will automatically build, deploy, and give you your live URL!

---

## 📱 Android APK Installation

An Android APK is generated for direct mobile installation.

### Method A: Download & Install Ready-to-Use APK
1. Download **`TelePhotos-v1.0.0.apk`** from the root of this project or the [Releases](https://github.com) section.
2. Transfer the `.apk` file to your Android phone (via USB, WhatsApp, or Telegram Saved Messages).
3. Tap the `.apk` file on your phone and tap **Install** *(allow "Install from Unknown Sources" if prompted)*.
4. Open **TelePhotos** $\rightarrow$ tap **Server Settings** $\rightarrow$ enter your backend URL (e.g. `https://your-backend.onrender.com/api`).

### Method B: Build the APK Yourself (1 Command)
Make sure Java (JDK 17+) and Android SDK are installed, then run:
```bash
cd client
npm run build:android
```
The compiled APK will be at `client/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📦 GitHub Release Checklist (What to Upload)

When publishing a public release on GitHub, follow this safety checklist:

### ✅ Safe to Upload to GitHub (Code Repository)
- [x] Full source code (`client/src`, `server/src`, `public/`)
- [x] [`render.yaml`](render.yaml) *(with `sync: false` for secrets)*
- [x] [`Dockerfile`](server/Dockerfile), [`docker-compose.yml`](docker-compose.yml)
- [x] [`.env.example`](.env.example) *(sample template with placeholder values)*
- [x] [`README.md`](README.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`LICENSE`](LICENSE)

### ❌ NEVER Upload to GitHub (Ignored by `.gitignore`)
- [ ] `.env` or `server/.env` *(contains real passwords, bot tokens, or API hashes)*
- [ ] `node_modules/` *(installed dependencies)*
- [ ] `client/android/.gradle/` or `client/android/app/build/` *(huge temporary binaries)*
- [ ] Private keystores (`*.keystore`, `*.jks`)

### 🏷️ Creating a GitHub Release (Attaching the APK)
1. Go to your GitHub repository $\rightarrow$ click **Releases** (right sidebar) $\rightarrow$ **Draft a new release**.
2. Tag version: `v1.0.0`.
3. Release title: `TelePhotos Vault v1.0.0 - Android APK & Cloud Drive`.
4. Drag and drop `TelePhotos-v1.0.0.apk` into the **Attach binaries** box.
5. Click **Publish release**. Anyone can now download the APK directly!

---

## 💻 Alternative Setup (Docker & Local)

### 🐳 Docker Compose (1 Command)
1. Clone the repository and copy the environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your Telegram API ID, Bot Token, and Channel ID
   ```
2. Start the application:
   ```bash
   docker compose up -d
   ```
3. Open `http://localhost` in your browser.

---

### 💻 Local Development Setup

#### 1. Backend:
```bash
cd server
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

#### 2. Frontend:
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ⚙️ Configuration Environment Variables

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | No | Server port (Default: `3001`) |
| `TELEGRAM_API_ID` | **Yes** | Telegram App API ID from `my.telegram.org` |
| `TELEGRAM_API_HASH` | **Yes** | Telegram App API Hash from `my.telegram.org` |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Bot Token from `@BotFather` |
| `TELEGRAM_CHANNEL_ID` | **Yes** | Private Storage Channel ID (e.g., `-1001987654321`) |
| `APP_PASSWORD` | **Yes** | Vault master password to unlock gallery |
| `JWT_SECRET` | No | Random secret for signing session tokens |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | No | Optional Gmail SMTP for sending reset OTPs |

---

## 📄 License
This project is licensed under the [MIT License](LICENSE). TelePhotos is an open-source personal tool and is not affiliated with or endorsed by Telegram FZ-LLC.
