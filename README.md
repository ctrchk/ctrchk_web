# 香港城市運輸單車 (City Transport Cycling Hong Kong — CTRC HK)

[![部署狀態](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://ctrchk.com)
[![當前版本](https://img.shields.io/badge/Version-v2.1.1--Beta-emerald)](https://ctrchk.com)

歡迎來到 **CTRC HK (香港城市運輸單車)** 的官方 GitHub 倉庫。本專案為香港單車愛好者與通勤者精心打造，是一個集高精度單車導航、遊戲化騎行追蹤、實時社交車隊、及數字錢包卡包與 3D 虛擬徽章於一體的綜合性 Web 平台與 PWA (Progressive Web Application) 漸進式應用程式。

---

## 1. 專案介紹

CTRC HK 深度整合了車道級單車導航、遊戲化成長體系、實時多人騎行房間與多終端數字卡包。系統自動識別用戶的訪問環境（網頁端 vs PWA 應用端），動態呈現高度客製化的使用者介面，解決了傳統單車出行工具缺乏趣味性、定位不精準、以及功能單一的痛點，為香港綠色出行提供可持續的基礎設施。

---

## 2. 使命與願景

* **使命 (Mission)**：**推廣城市減碳，普及單車出行**。透過低門檻、強趣味、高實用性的數位工具，讓單車成為港人日常通勤、休閒與運動的首選綠色交通工具。
* **願景 (Vision)**：為全港單車徑網絡（包括將軍澳、沙田、吐露港等）建立首個基於 Web 的 3D 車道級動態導航、實時路況共享與健全的車手經濟社群生態系統。

---

## 3. 當前開發狀態

本專案處於快速迭代的 **v2.1.1 Beta** 階段：
* **雲端服務**：已在 Vercel 部署上線，對接高性能 PostgreSQL 數據庫實現全端數據同步。
* **核心模組**：多人房間、WalletWallet 電子錢包卡包、3D 徽章展廳、Brouter 智慧單車導航均已穩定營運。
* **社群生態**：深度對接 Discord 身份組同步，實現線上線下一體化的騎手榮譽認證。

---

## 4. 核心功能亮點

### 4.1 網頁與 PWA 雙端架構 (Hybrid Platform)
* **網頁模式 (Web Mode)**：著重品牌推廣、單車文化部落格（支援用戶投稿與管理審核）、路線預覽（不套用 grayed-out 未征服濾鏡）與標準 GPX 軌跡下載。
* **PWA 獨立應用模式 (PWA Mode)**：安裝至主畫面後解鎖沈浸式「工業風騎行工作台 (Industrial HUD)」、屏幕常亮鎖定 (Screen Wake Lock)、高精度定位追蹤、離線數據緩存與原生級底部導航欄。

### 4.2 三軌制遊戲化經濟體系 (Three-Track Economy)
* **經驗與等級軌 (Level / EXP)**：內建 50+ 級稱號晉級機制（由「入門車手」至「頂尖車手」），根據騎行模式動態結算 EXP（旅遊 `x1.5`、通勤 `x1.0`、自由 `x0.8`），輔以完成獎勵與盲盒隨機 XP。
* **365 天滾動里程卡軌 (Rolling Mileage Tiers)**：以近 365 天累積里程決定會員卡級，過期里程自動滾動扣除。
  * **銅卡 (Bronze - 0km 起)**：基礎 2D 導航、基礎數據、隨機盲盒。
  * **銀卡 (Silver - $\ge 150\text{km}$)**：解鎖 CYCPARKSPACE 泊位與 Ramp 坡道圖層、5 個途經點自訂規劃、永久 $+5\%$ 里程幣結算加成。
  * **金卡 (Gold - $\ge 500\text{km}$)**：解鎖 Mapbox 3D 高精度車道視角、黑金極簡高對比主題、永久 $+15\%$ 里程幣加成。
* **里程幣軌 (Coins)**：用於在路線商城解鎖特定「特別版/挑戰」路線、或花費 `100 幣` 修復中斷的通勤連勝。

### 4.3 專業級單車徑導航與 GPS 穩定
* **Brouter 導航引擎**：專為單車路網設計，高額懲罰推車路段（100倍權重），完全避開主幹繁忙公路，OSRM 作為自動降級備援。
* **GPS 軌跡吸附與低速鎖定**：GPS 位置實時貼附至單車徑中心線。當騎行時速低於 $3\text{ km/h}$ 時，地圖方向自動鎖定為路段朝向，解決 compass 漂移旋轉問題。
* **偏離與到站預警**：利用 Turf.js 設置 50 米偏離路線（偏離路線預警）提示，以及到站自動打卡與本地 Web Push 報站通知。

### 4.4 多人聯動與位置同步 (Multiplayer)
* **多人房間系統**：支援建立公開或密碼保護的私密房間。地圖實時標註所有隊友的位置。
* **斷點續傳 (Session Resumption)**：意外中斷退出時，首頁「未完成行程」卡片會留存 `roomCode`，點擊即可一鍵重回原有車隊。

### 4.5 電子錢包與 3D 徽章
* **Apple/Google Wallet 整合**：對接 WalletWallet API 永久免費通道，根據用戶卡級（金/銀/銅）自動匹配配色樣式、姓名、滾動里程及動態 QR 條碼。
* **3D 專屬徽章**：用戶 profile 頁面搭載 `<model-viewer>`，支援實時 3D 縮放與旋轉檢視 GLB/USDZ 成就徽章。

### 4.6 香港挑戰賽 (Hong Kong Challenge)
* 內建 30km、60km、100km 三檔挑戰，點擊路線標題旁的金色獎盃進入專區（路線 960 與自由模式明確排除）。

---

## 5. 技術棧 (Technology Stack)

* **前端 (Frontend)**：
  - 核心：原生 HTML5 / CSS3 / ES6+ JavaScript（不依賴 Tailwind/React，保證極致載入速度）。
  - 地圖：Leaflet.js（CartoDB Dark 主題瓦片）、MapLibre GL JS、Mapbox GL JS。
* **後端 (Backend)**：
  - Vercel Serverless Functions (Node.js)。
  - JWT 用戶認證、Google OAuth 2.0 登入。
* **數據庫 (Database)**：
  - PostgreSQL (Neon / Supabase)。
* **移動端增強 (PWA)**：
  - Service Worker (離線緩存與 Safari 相容優化)、Web App Manifest、Screen Wake Lock API、Web Notifications API。

---

## 6. 倉庫目錄結構 (Repository Structure)

```
├── api/                  # Node.js Serverless API 路由端點 (用戶、管理、聊天、部落格、論壇、歷史記錄)
├── css/                  # 樣式表，包含全域與 Industrial HUD 主題 main.css
├── data/                 # 將軍澳單車徑網絡與人行道 GeoJSON 空間數據集
├── db/                   # 數據庫結構備份與初始化腳本
├── discord-bot/          # Discord 身份組同步機器人源碼
├── docs/                 # 本地文檔目錄
│   └── Product/          # 產品架構設計與技術指標 SPEC
├── gpx/                  # 官方認證單車路線 GPX 軌跡文件
├── images/               # 圖片資源、圖標及海報背景
├── js/                   # 前端核心腳本 (main.js, pwa.js, login.js, supabase-config.js)
├── index.html            # 首頁入口 (瀏覽器 Web 介紹頁 / App 歡迎工作台)
├── ride.html             # 核心騎行監控與單頁 Industrial HUD 儀表板
├── nav.html              # 獨立單車徑導航路徑規劃器 (Brouter)
├── routes.html           # 路線圖籍與香港挑戰賽入口
├── profile.html          # 個人中心與 3D 虛擬徽章展廳
├── database-schema.sql   # PostgreSQL 資料庫表結構初始化 SQL
├── sw.js                 # 離線 Service Worker 快取模組
└── vercel.json           # Vercel 路由配置與 Serverless 映射
```

---

## 7. 項目文檔結構 (Documentation Structure)

所有引導指南與架構手冊均歸檔於此：
* **產品與技術 SPEC**：
  - `docs/Product/PRODUCT_SPEC.md` — 產品深度技術SPEC，詳解三軌制經濟與導航演算法。
* **資料庫與部署**：
  - `DATABASE-SETUP.md` — PostgreSQL 數據庫初始化指引。
  - `DEPLOYMENT-CHECKLIST.md` 與 `DEPLOYMENT-FIX.md` — 雲端服務上線檢驗清單。
* **開發與功能指南**：
  - `ADMIN_SETUP_GUIDE.md` — 管理員后台設置指南。
  - `APP-DEVELOPMENT.md` — PWA 開發演進歷程與下一步規劃。
  - `MILEAGE.md` — 里程計劃卡級規則與電子錢包設置細節。
  - `TESTING-GUIDE.md` — 認證與升級測試指引。
  - `UPDATELOG.md` — 工程更新日誌 (v1.0.0 至 v2.1.1)。

---

## 8. 開發路線圖 (Development Roadmap)

### 近期 (Short-Term)
* 優化地下通道或高架橋下的 GPS 定位防漂移補償。
* 校準將軍澳新開闢路段的 GPX 站點座標。
* 擴展 3D 徽章展廳對多種材質 GLB 的光源渲染。

### 中期 (Medium-Term)
* 導入沙田及馬鞍山單車路網的動態拓撲模型。
* 上線里程幣兌換實體單車周邊或商戶優惠券。
* 實現基於 Service Worker 的 Brouter WASM 純前端完全離線導航。

---

## 9. 快速開始 (Getting Started)

### 1. 克隆倉庫
```bash
git clone https://github.com/ctrchk/ctrchk.git
cd ctrchk
```

### 2. 安裝依賴
```bash
pnpm install
```

### 3. 配置環境變量
在項目根目錄創建 `.env` 文件並填入：
* `DATABASE_URL`: PostgreSQL 資料庫連接串
* `JWT_SECRET`: JWT 簽名密鑰
* `GOOGLE_CLIENT_ID`: Google OAuth 憑證 ID
* `SMTP_USER` / `SMTP_PASS`: 電子郵件 SMTP 驗證憑證

### 4. 啟動本地開發服務
```bash
vercel dev
```

---

## 10. 生產部署 (Deployment)

本專案完全適配 Vercel 生產部署：
1. 將此倉庫導入至您的 Vercel 帳號。
2. 在 Vercel Settings 中配置上述所有環境變量。
3. 對您的 PostgreSQL 執行 `database-schema.sql` 完成表結構初始化。
4. 提交至 Git 觸發 Vercel 自動構建與部署。

---

## 11. 貢獻指南 (Contribution Guide)

歡迎一切旨在提升香港單車環境的開發貢獻：
1. Fork 本倉庫並創建您的功能分支。
2. 請嚴格遵守不使用 Tailwind 等 CSS 框架的原生 CSS 規範，保持 main.css 架構整潔。
3. 提交 GPX 與 GeoJSON 數據前需進行精確的座標校對。
4. 提交 PR 前確保運行本地驗證。

---

## 12. 版權許可 (License)

&copy; 2026 CTRC HK (香港城市運輸單車). 版權所有。
本專案代碼與文檔均受版權保護。
