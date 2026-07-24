# 香港城市運輸單車 (City Transport Cycling Hong Kong — CTRC HK)

[![Deployment Status](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://ctrchk.com)
[![Version](https://img.shields.io/badge/Version-v2.1.1--Beta-emerald)](https://ctrchk.com)

Welcome to the official repository of **CTRC HK (City Transport Cycling Hong Kong)**, a professional and interactive web platform and Progressive Web Application (PWA) tailored for urban cyclists in Hong Kong.

---

## 1. Project Introduction

CTRC HK integrates high-precision navigation, gamified fitness tracking, real-time social tools, and mobile physical-digital connections (such as Apple/Google Wallet cards and 3D virtual badges) to deliver a comprehensive urban cycling platform. Whether commuting, exploring scenic trails, or competing in regional challenges, CTRC HK elevates the cycling experience in Hong Kong.

---

## 2. Mission & Vision

* **Mission (使命)**: Encourage sustainable, low-carbon city transport (城市減碳) by promoting cycling as a reliable daily commuting and recreational alternative.
* **Vision (願景)**: Establish a smart, safe, and connected cycling ecosystem across Hong Kong. We aim to leverage mobile technology to make cycling highly trackable, rewarding, and community-driven.

---

## 3. Current Development Status

The platform is in active development and currently operating at **v2.1.1 Beta**.
* **Live Service**: Deployed on Vercel with database synchronization.
* **Stable Channels**: Digital wallet passes (WalletWallet API), multiplayer rooms, 3D badges showroom, and high-precision Leaflet/MapLibre navigations are fully functional.
* **Target Audience**: Active Hong Kong commuters, recreational riders, and cycling groups.

---

## 4. Core Features

### 4.1 Hybrid Platform Architecture (Web & PWA)
* **Web Mode (Browser)**: Optimized for branding, routes preview (without grayed-out filters), GPX downloading, and community blog publishing.
* **PWA Mode (App Standalone)**: Activates on standalone home-screen installation. Features an Industrial HUD, background Screen Wake Lock, real-time tracking, offline caching, and native-feeling bottom navigation.

### 4.2 Three-Track Economy & Gamification
* **EXP & Level Track**: 50+ configuration levels with custom title progression (入门车手 to 顶尖车手). Rides earn EXP adjusted by mode multipliers (Travel `x1.5`, Commute `x1.0`, Free Mode `x0.8`). Includes dopamine gacha random bonuses.
* **365-Day Rolling Mileage**: Automatically calculates total mileage over a rolling 365-day window. Tier-specific cards adjust dynamically:
  * **Bronze (銅卡)**: Standard features.
  * **Silver (銀卡 - $\ge 150\text{km}$)**: Access to CYCPARKSPACE map layers, multi-stop routing (up to 5 stops), $+5\%$ Coin bonus.
  * **Gold (金卡 - $\ge 500\text{km}$)**: Mapbox 3D lane-level views, high-contrast Black Gold theme, $+15\%$ Coin bonus.
* **Coins Economy (里程幣)**: Used to purchase special routes or repair broken sign-in streaks.

### 4.3 Navigation & GPS Snapping
* **Smart Route Planning**: Employs a custom Brouter cycling engine prioritising dedicated cycle tracks and penalising pushing sections (100x weight). Falls back to OSRM if offline.
* **Snapping & Low-Speed Stability**: Snaps coordinates to cycleway node centerlines. Map bearing locks to the path direction at speeds below $3\text{ km/h}$ to avoid compass spinning.
* **Off-Route & Stop Alerts**: Alerts users with visual cues (Turf.js 50m threshold) and triggers local push notifications on station approach.

### 4.4 Multiplayer & Social Subsystems
* **Rooms-Based Multiplayer**: Create public or password-locked private rooms. Shares real-time locations of members on map markers.
* **Session Resumption**: Persists `roomCode` in active ride states, letting users reconnect immediately after signal loss.
* **Integrated Chat & Forum**: Direct user-to-user messaging with instant polling (3s interval) and localized boards.

### 4.5 Digital Pass & 3D Badges
* **Wallet Passes**: Free, permanent Apple/Google Wallet integration via WalletWallet API. Automatically matches card color (Gold, Silver, Bronze) with dynamic QR codes.
* **3D Virtual Badges**: `<model-viewer>` integration on profile page displaying GLB/USDZ models managed in the admin dashboard.

### 4.6 Hong Kong Challenge
* Tiered challenges ($30\text{km}$, $60\text{km}$, $100\text{km}$) accessible via the trophy icon on the routes catalog page.

---

## 5. Technology Stack

* **Frontend**:
  - Vanilla HTML5 / CSS3 / JavaScript (ES6+) — No Tailwind/React dependencies.
  - Map engines: Leaflet.js (CartoDB Dark Tiles), MapLibre GL JS, Mapbox GL JS.
  - UI Features: Glassmorphism, CSS variable themes (Light, Dark, Black Gold), Canvas.
* **Backend**:
  - Vercel Serverless Functions (Node.js).
  - JWT (JSON Web Token) authentication & Google OAuth 2.0.
* **Database**:
  - PostgreSQL (Neon / Supabase / Vercel Postgres).
* **Progressive Web App**:
  - Service Worker cache strategies, Web App Manifest, Screen Wake Lock API, Web Push Notifications.

---

## 6. Repository Structure

```
├── api/                  # Node.js Serverless endpoints (User, Admin, Chat, Blog, Forum, History)
├── css/                  # Styling files including main.css (Variable-driven themes & Industrial HUD)
├── data/                 # Geographic datasets (TKO GeoJSON files, pedestrian/track networks)
├── db/                   # Database schemas and backups
├── discord-bot/          # Discord Integration bot source and configurations
├── docs/                 # Documentation directory
│   └── Product/          # Detailed product specifications and architecture briefs
├── gpx/                  # Verified GPX route files
├── images/               # Image assets, logo icons, and high-contrast posters
├── js/                   # Frontend logic modules (main.js, pwa.js, login.js, supabase-config.js)
├── index.html            # Main Entry Point (Web portal or App Welcome console)
├── ride.html             # Active ride tracker & industrial HUD console
├── nav.html              # Custom navigation planner (Brouter / OSRM)
├── routes.html           # Routes Catalog & Hong Kong Challenge entry
├── profile.html          # User profile and 3D badge viewer
├── database-schema.sql   # SQL file for DB tables and relations initialization
├── sw.js                 # PWA Service Worker for caching and Safari mitigation
└── vercel.json           # Vercel deployment routes configurations
```

---

## 7. Documentation Structure

All official guidelines and technical sheets are organized as follows:
* **Product Documentation**:
  - `docs/Product/PRODUCT_SPEC.md` - Technical specification of all core systems and calculations.
* **Deployment & Setup**:
  - `DATABASE-SETUP.md` - PostgreSQL setup and initialization.
  - `DEPLOYMENT-CHECKLIST.md` & `DEPLOYMENT-FIX.md` - Vercel live server setup steps.
* **Guides**:
  - `ADMIN_SETUP_GUIDE.md` - Step-by-step manager portal configurations.
  - `APP-DEVELOPMENT.md` - Detailed design decisions and history of the PWA app.
  - `MILEAGE.md` - Mileage card limits,保级 logic, and wallet details.
  - `TESTING-GUIDE.md` - Authentication verification checklists.
  - `UPDATELOG.md` - Engineering changelog and version history.

---

## 8. Development Roadmap

### Short-Term
* Refine real-time GPS synchronization accuracy for complex underground passages.
* Standardize GPX waypoints coordinate mappings for newly opened cycle tracks.
* Expand the model-viewer formats compatibility for additional 3D virtual badges.

### Medium-Term
* Develop Sha Tin region cycleway network routing models.
* Introduce mileage-based store discounts and token utilities.
* Optimize WASM-based Brouter routing to run fully offline within the Service Worker.

---

## 9. Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/ctrchk/ctrchk.git
cd ctrchk
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Setup environment variables
Create a `.env` file or set the following in your local runner:
* `DATABASE_URL`: Your PostgreSQL connection string.
* `JWT_SECRET`: Secret key for JWT signature.
* `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Client credentials ID.
* `SMTP_USER` / `SMTP_PASS`: Credentials for email validation services.

### 4. Run local server
Run the Vercel development server:
```bash
vercel dev
```

---

## 10. Deployment

This project is optimized for deployment on Vercel:
1. Connect this repository to your Vercel account.
2. Configure the required environment variables under Project Settings.
3. Apply `database-schema.sql` on your PostgreSQL database (Neon or Supabase).
4. Deploy with a single commit.

---

## 11. Contribution Guide

We welcome contributions from the community:
1. **Fork** the repository and create your feature branch.
2. Ensure you adhere to the Tailwind-free CSS coding styling.
3. Write high-precision coordinates with precise decimal points.
4. Run validation checks before submitting a Pull Request.

---

## 12. License

&copy; 2026 CTRC HK (City Transport Cycling Hong Kong). All Rights Reserved.
This project is licensed under the terms described in the standard repository license files.
