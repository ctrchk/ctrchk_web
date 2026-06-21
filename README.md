# 香港城市運輸單車 CTRC HK — 官方網站與 PWA 應用

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://ctrchk.com)

CTRC HK（香港城市運輸單車）是一個專為香港單車愛好者設計的綜合平台。結合了單車路線探索、遊戲化騎行記錄、以及高精確度的單車徑導航系統。

---

## 🚀 核心特色

### 1. 🔀 網頁與 App (PWA) 深度分工
系統自動偵測訪問環境並切換介面：
- **網頁版 (Web)**：側重品牌宣傳、單車文化網誌、詳細路線圖籍查閱及 GPX 檔案下載。
- **App 版 (PWA)**：安裝至手機後，提供沈浸式的騎行工作台、地圖導航、即時數據監控及個人成就系統。

### 2. 🚴 遊戲化騎行系統
- **標準模式**：選擇指定路線，依序到達沿途站點以「征服」路線。
- **自由模式 (Free Mode)**：無固定路線，隨時開始記錄您的騎行軌跡、時間與里程。
- **等級與 XP 系統**：內建超過 50 級的成長體系。透過骑行、打卡、跨區、完成每日任務賺取 XP 與里程幣 (Coins)。
- **稱號系統**：從「入門車手」晉升至「頂尖車手」。

### 3. 👥 共同騎行與位置共享
- **好友互動**：在騎行時勾選「與朋友一起騎行」，系統會實時同步並在地圖上顯示同一路線上的好友位置。
- **雲端備份**：行程中斷時自動保存進度至雲端，可隨時在不同設備上恢復未完成的行程。

### 4. 🧭 專業單車徑導航
- **3D 車道級導航**：支持 3D 建築視圖與高精確度動畫引導。
- **單車徑優先**：導航算法優先推薦專用單車徑，避開繁忙公路。
- **路線吸附 (Snapping)**：GPS 位置自動貼附至單車徑中心線，確保定位精準。

### 5. 📅 任務與成就
- **每日簽到**：28 天獎勵循環，連續簽到獲取巨額獎勵。
- **每日任務**：完成指定目標（如騎行 1 小時、到達 20 站）獲得額外加成。
- **成就徽章**：解鎖隱藏成就，展示您的騎行資歷。

---

## 🛠️ 技術架構

| 組件 | 技術 stack |
|------|------------|
| **前端** | Vanilla HTML5 / CSS3 / JavaScript (ES6+), Leaflet, MapLibre GL JS |
| **後端** | Vercel Serverless Functions (Node.js) |
| **資料庫** | PostgreSQL (Supabase / Vercel Postgres) |
| **認證** | JWT (JSON Web Token), Google OAuth 2.0 |
| **PWA** | Service Worker, Web Manifest, Push API, Screen Wake Lock API |

---

## 📂 目錄結構

- `api/`：後端 Serverless API 邏輯。
- `js/`：核心腳本，含 `main.js` (全站邏輯) 與 `pwa.js` (App 輔助功能)。
- `css/`：工業風深綠主題樣式。
- `gpx/`：官方認證的單車路線軌跡檔。
- `routes.json`：全站路線資料與等級配置的單一事實來源。
- `index.html`：動態主頁（Web 簡介 / App 工作台）。
- `ride.html`：核心騎行介面（雙頁設計：地圖 ↔ 數據）。
- `nav.html`：獨立導航系統。

---

## 📦 部署與設置

1. **環境變數**：
   - `DATABASE_URL`：PostgreSQL 連接字串。
   - `JWT_SECRET`：JWT 簽名密鑰。
   - `GOOGLE_CLIENT_ID`：Google 登入憑證。
   - `SMTP_USER` / `SMTP_PASS`：電郵驗證服務。

2. **資料庫初始化**：
   執行 `database-schema.sql` 以建立必要的資料表。

3. **本地開發**：
   使用 `vercel dev` 啟動模擬環境。

---

## 📜 版權聲明

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
本專案為 CTRC HK 官方開發與運管之技術平台。
