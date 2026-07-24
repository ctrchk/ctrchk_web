# CTRC HK 香港城市運輸單車 — 內部開發指南 (Internal Development Guide)
<!-- 版本: v2.1.1-Beta -->
<!-- 適用對象: 未來人類工程師、AI 代理 (例如 Google Jules, Claude Code, Cursor, ChatGPT, Gemini, Copilot) -->

歡迎閱讀《CTRC HK 香港城市運輸單車》平台內部工程開發與維護指南。本文件旨在為所有參與本專案開發、優化、重構以及日常維護的軟體工程師（包括所有高階 AI Agent）提供一套嚴格、一致、可執行的技術規範與架構說明。

---

## 第一章：專案定位

### 1.1 背景與願景
CTRC HK (香港城市運輸單車) 是一個專為香港設計的單車導航與騎行遊戲化生態系統，目前核心的服務地區專注於**香港將軍澳示範區**。
本專案採用**單一程式碼庫 (Single Repository)** 同時支援 **Web 模式** 與 **PWA 獨立應用模式**：
*   **Web 模式**：面向公眾、側重 SEO、品牌宣傳、網誌內容。
*   **PWA 模式**：面向騎行者，提供高度沈浸式的工業風 HUD 儀表板、實時高精度 GPS 吸附導航、多人聯動房間、電子錢包卡包整合與離線緩存系統。

### 1.2 維護現狀與工程制約
目前專案處於**極少開發者長期維護** 的狀態。這是一個極為重要的工程制約條件。
因此，本專案的生命線是：**「保持簡單，保持容易維護，決不為了炫技而增加系統複雜度。」**

當你需要引入一個新工具、撰寫一段新邏輯、或是引入第三方依賴時，請務必反問自己以下三個問題：
1.  這段程式碼在三年後，如果沒有任何文檔，其他開發者能否在 5 分鐘內完全看懂？
2.  如果不引入這個 npm 套件，使用瀏覽器原生的 Web API 能否用 30 行程式碼實現同樣的效果？
3.  這個功能如果失敗了，會不會直接導致整個應用崩潰（Crash）或地圖無法載入？

**工程核心共識**：簡單的程式碼比精妙但晦澀的程式碼更有價值。

---

## 第二章：開發原則

在 CTRC HK 的日常開發中，所有決策都必須遵循以下四大黃金原則：

### 2.1 優先修復 Bug (Bug-First Priority)
任何新功能（無論看起來多麼吸引人）的開發優先級，永遠低於現存的穩定性問題。在啟動 any Feature 以前，必須確保以下問題的隊列為零：
1.  **崩潰 (Crash)**：任何導致 JS 執行中斷、白屏、地圖載入中斷的 Exception。
2.  **記憶體洩漏 (Memory Leak)**：特別是 Leaflet 地圖、定時器、WebSocket 或事件監聽器未被垃圾回收的問題。
3.  **UI 跑版或阻擋 (UI Blocking)**：遮擋了 HUD 關鍵數值、按鈕無法點擊或黑金/淺色主題對比度不足的問題。
4.  **GPS 定位與導航異常**：GPS 無法追蹤、斷線後無法自動重連、吸附演算法錯誤、低速朝向旋轉瘋狂打轉的問題。

### 2.2 不做過度工程 (No Over-Engineering)
我們嚴格禁止在程式碼中進行無意義的抽象和過早優化。
*   **嚴禁設計模式濫用**：禁止為了實現一個簡單的資料轉換，而套用十層 Abstraction（例如：寫了五個 Interface、三個 Factory 與兩個 Wrapper 只為了導出一個簡單的 JSON）。
*   **禁止無端引入 Framework**：本專案採用 Vanilla JS、原生 HTML 與標準 CSS Variable 控制。請勿為了「看起來比較專業」而引入 React, Vue, Svelte 或任何重型的單頁框架。如果原生 JavaScript 能夠實現，請直接使用原生 JavaScript。
*   **禁止過早優化**：不要預期十萬人同時在線而設計複雜的分散式鎖或快取同步機制。

### 2.3 優先使用瀏覽器原生 API (Native Web API First)
現代瀏覽器已具備強大的原生能力，我們應當最大化利用這些 API：
*   **定位**：優先使用 `navigator.geolocation` 配合高精度參數（如 `enableHighAccuracy: true`）。
*   **螢幕常亮**：優先使用 `navigator.wakeLock` 防止手機鎖屏，而非引入外部休眠阻止庫。
*   **通知**：優先使用 `Notification` 與 Service Worker `registration.showNotification` 進行報站推送。
*   **快取**：優先使用 `Cache API`、`IndexedDB` 與 `localStorage` 進行離線資料儲存。
*   **DOM 監聽**：優先使用 `IntersectionObserver`（延遲載入）、`ResizeObserver`（地圖自適應視窗縮放）與 `MutationObserver`。
*   **動畫**：優先使用 CSS 3 Transition/Animation 配合 GPU 加速，嚴禁無故引入 Lottie 或 Framer Motion。

### 2.4 優先改善體驗 (Experience-First Strategy)
在 CTRC HK，我們認為一個 **0.2 秒流暢流暢、具備觸覺反饋（Haptic Feedback Scale-down）的頁面切換與點擊效果**，其工程價值遠高於增加一個新功能。
*   所有的 primary button 必須擁有 `.btn-click-effect`（點擊時縮小至 `0.96` 倍）。
*   任何大範圍 UI 切換必須具備全域淡入淡出滑動動畫 (`pwaPageEnter`)。

---

## 第三章：目前專案架構

本專案採用輕量級的**JAMstack 靜態前台 + Serverless API 後端**架構，全部託管於 **Vercel**，資料庫使用託管的 **Neon Database**。

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Vercel 邊緣節點                            │
│                                                                        │
│   ┌──────────────────────────────┐    ┌────────────────────────────┐   │
│   │       客戶端靜態資源 (HTML/CSS/JS)   │    │  Serverless APIs (/api/*)  │   │
│   │                              │    │                            │   │
│   │  - sw.js (PWA Service Worker)│    │  - api/user.js             │   │
│   │  - css/main.css (主題與變數)  │    │  - api/getHistory.js       │   │
│   │  - js/main.js (語系與基礎邏輯) │────►│  - api/oauth.js            │   │
│   └──────────────┬───────────────┘    └──────────────┬─────────────┘   │
└──────────────────┼───────────────────────────────────┼─────────────────┘
                   │                                   │
                   ▼ (地圖與路由服務)                   ▼ (資料儲存)
     ┌────────────────────────────┐     ┌────────────────────────────┐
     │  外部服務 API              │     │  Neon Database             │
     │  - Mapbox / Leaflet Tiles  │     │  (PostgreSQL 關係資料庫)     │
     │  - Brouter (單車徑拓撲)     │     │                            │
     │  - WalletWallet (錢包卡包) │     │  - users / active_rides    │
     └────────────────────────────┘     └────────────────────────────┘
```

### 3.1 各技術組件之職責與關聯

#### 3.1.1 HTML 結構 (HTML Structures)
HTML 檔案是核心頁面的進入點。每個 HTML 均具備完整的 DOM 結構，在 SPA 模式下，主要透過容器置換（如 `main` 和 `.tasks-container`）來達成無跳轉頁面切換。
*   `index.html`：Web 門戶主頁，負責引導公眾，提供主要的 SEO 關鍵詞及核心產品理念說明。
*   `routes.html`：單車路線圖籍與香港挑戰賽的核心入口，包含「金色獎盃」挑戰賽啟動點。
*   `ride.html`：實時導航 HUD 與自由騎行的核心 PWA 工作台，所有地圖渲染與儀表邏輯皆在此。
*   `dashboard.html`：個人儀表板、等級、里程與任務狀態，需要高頻重置快取標記。
*   `profile.html`：個人設定與 3D 虛擬徽章展覽室。

#### 3.1.2 CSS 系統 (CSS Styling & Theme Engine)
整個專案的樣式都集中在 `css/main.css` 中。
*   採用**CSS 變數驅動 (CSS Variable-Driven)** 設計。
*   核心變數如 `--app-bg-primary`, `--app-accent`, `--app-text-primary` 控制全局配色。
*   支援三套皮膚主題：**Light (淺色)**、**Dark (深色)** 與專屬的 **Black Gold (黑金高對比主題 `rank-gold`)**。
*   在 `rank-gold` 模式下，必須嚴格強制高對比（如黑字 `#000000 !important` 顯示於金黃背景上），確保騎士在戶外烈日下依然能安全閱讀。

#### 3.1.3 JavaScript 與客戶端核心 (JS Engine)
*   `js/main.js`：包含語言偏好設定（持久化儲存於 `localStorage` 且防跳轉循環）、主題自適應機制、全域資料快取（如 routes 快取與動態覆寫邏輯）、登入登出狀態更新、以及離線數據同步。
*   `js/supabase-config.js` / `js/login.js`：負責客戶端與後端安全認證對接。
*   `sw.js`：Service Worker 核心。負責全站靜態資源離線緩存、Safari 優化（避免無限跳轉與 Fetch 錯誤），並在網絡回復時自動調用後台同步。

#### 3.1.4 地圖渲染引擎：Leaflet 與 MapLibre (Map Engine)
為了保持極致的移動端流暢度與避免耗電過多，CTRC HK 的核心騎行工作台 `ride.html` 採用 **Leaflet** 渲染（搭配 CartoDB Dark 暗色圖磚）。
*   在 `nav.html` 的部分 3D 特效與路徑引導中，我們會使用 **MapLibre GL JS** / Mapbox。
*   在 SPA 模式中切換頁面時，地圖必須在 `pwa-page-show` 事件觸發後 150ms 執行 `.invalidateSize()` 或 `map.resize()`，以防止地圖因隱藏容器導致大小計算錯誤、白屏或圖磚破碎。

#### 3.1.5 路由引擎：Brouter (Route Optimizer)
專案整合了 Brouter 單車路由拓撲演算法，對「需要推車或混行繁忙公路」的路段施加 100 倍以上的權重處罰，最大化將騎士引導至專用單車徑。

#### 3.1.6 雲端資料庫與 Serverless 後端 (Database & Serverless)
*   **Neon Database**：底層為託管 PostgreSQL，在 `database-schema.sql` 中定義了嚴格的 RLS (Row Level Security) 與關聯约束。
*   **Vercel Serverless Functions (`api/*.js`)**：為了解決 Vercel Hobby 免費方案的邊緣限制，避免新增過多 Serverless Functions 導致額度超限，我們採用**將多個關聯操作合併至單一 endpoint 的策略**（例如：將錢包、金卡資訊、路由動態讀取等功能合併至 `api/user.js`，透過傳入不同的 `action` 參數進行路由分發）。

---

## 第四章：目前重要模組

本章詳細列出 CTRC HK 平台中所有關鍵業務模組的定位、主要檔案、核心依賴與「絕對不可擅自修改」的安全警戒紅線。

### 4.1 登入與驗證模組 (Auth Module)
*   **業務用途**：處理使用者帳號生命週期，包含郵件註冊、驗證、登入、忘記密碼、Google 第三方 OAuth 授權登入、以及 Discord Bot 社群綁定。
*   **主要檔案**：
    *   後端 API：`/api/login.js`, `/api/register.js`, `/api/oauth.js`, `/api/password-reset.js`
    *   前端：`/js/login.js`, `login.html`, `register.html`, `auth-callback.html`
*   **核心依賴**：Supabase Auth, JWT Token, Google One-Tap SDK, Discord Developer API.
*   **安全紅線**：
    1.  **Token 清洗邏輯**：在 `js/main.js` 與 `api/user.js` 中對 token 進行的引號清洗及 `'null'` 字串過濾邏輯（防範 Supabase 偶然寫入字面量 `'null'` 導致永久授權漏洞）**絕對不可移除或簡化**。
    2.  **Token 來源解析**：所有 API 在調用 `authenticate(req)` 時，若 `user_id` query 參數遺失，必須強制回退至 Authorization Header 解析所得之 JWT `userId`。

### 4.2 實時騎行與 HUD 儀表板 (Ride HUD Module)
*   **業務用途**：在車友騎行過程中，提供工業風的大字體 HUD，展示當前時速、累計里程、累計時間、已省車資（綠色交通指標）、中途站 Stop Pills 的橫向滾動報站。
*   **主要檔案**：
    *   前端：`ride.html`, `nav.html`
    *   核心邏輯：`/js/pwa.js` (導航與吸附核心)
*   **核心依賴**：Leaflet.js, Turf.js (緩衝與距離檢測), Screen Wake Lock API.
*   **安全紅線**：
    1.  **3 秒極速載入限制**：自由騎行 (Free Mode) 開啟時，**前 3 秒必須完全繞過所有耗時的 API 網路請求**（如用戶配置、全量路線數據加載），地圖必須立即渲染，保證騎士即點即走，網路請求應在背景非同步慢速補載。
    2.  **心跳定時器 (Heartbeat Timers)**：用於背景軌跡記錄的定時器與 `watchPosition` 事件必須綁定在宿主操作系統的真實 Epoch Time，嚴禁使用簡單的 JS 累加變數，防範因背景休眠導致里程遺失。

### 4.3 多人聯動房間系統 (Multiplayer Room Module)
*   **業務用途**：允許多個車友透過「公開」或「密碼私密」房間在同一地圖上即時顯示彼此位置。
*   **主要檔案**：
    *   後端 API：`/api/chat.js` (承載多人房位置同步、狀態監聽、消息派發)
    *   前端：`ride.html` (多人同屏渲染、Resumption 恢復)
*   **核心依賴**：WebSockets (或 Polling Heartbeat Fallback), `localStorage` 快取暫存。
*   **安全紅線**：
    1.  **Session Resumption (連線恢復機制)**：當 PWA 因為電話中斷、崩潰或閃退重新打開時，如果 `localStorage` 中存在未完成的 `roomCode` 且處於 24 小時時效內，必須**自動將騎士重新帶入原有多人房**並回復其軌跡。
    2.  **連線降級**：當 WebSocket 連接中斷時，多人位置同步必須優雅回退，不得阻礙或凍結本地騎士的導航與里程記錄。

### 4.4 數字錢包卡包模組 (Wallet Pass Module)
*   **業務用途**：將用戶的里程卡一鍵添加至 Apple Wallet 或 Google Wallet，展示級別頭銜、滾動累積里程與專屬卡面。
*   **主要檔案**：
    *   後端 API：`/api/user.js?action=wallet-pass`
    *   前端：`dashboard.html` (卡包添加入口), `profile.html`
*   **核心依賴**：WalletWallet API.
*   **安全紅線**：
    1.  **LogoURL 域解析**：在 localhost / 測試沙盒環境下，WalletWallet 的 API 伺服器無法訪問 `localhost`，因此程式碼中必須**自動將圖片域回退至官方 GitHub RAW 圖片 Fallback**。而在 Vercel 生產環境，必須使用 `req.headers.host` 解析出絕對的 SSL 域名網址。**嚴禁將 logo 寫死為單一本地 IP 或假定域名，否則卡包無法下載**。
    2.  **級別色彩一致性**：卡包卡面（銅卡、銀卡、金卡）配色與背景渲染必須與 `MILEAGE.md` 及 CSS variables 保持高度一致。

### 4.5 滾動里程與反作弊模組 (Mileage & Anti-Cheat)
*   **業務用途**：基於 365 天滾動里程更新車手等級與保級狀態；在騎行結束時，審查軌跡 GPX。
*   **主要檔案**：
    *   後端 API：`/api/getHistory.js` (歷史結算、反作弊核心、XP Coin 派發)
    *   前端：`mileage.html`, `routes.html`
*   **核心依賴**：PostgreSQL Interval Queries, Turf.js.
*   **安全紅線**：
    1.  **45 km/h 速度牆 (Speed Limit)**：任何軌跡點的點對點瞬時時速或全趟平均時速大於 **$45\text{ km/h}$** 的騎行記錄，一律視為交通工具作弊。此記錄自動標記 `anti_cheat = true`，且不計入任何挑戰賽進度、不發放 XP 與里程幣。
    2.  **挑戰賽白名單限制**：自由騎行模式 (Free Mode) 以及 960 號路線（Route 960, tko-960）**嚴禁被納入 30k/60k/100k 香港挑戰賽的計分統計中**，該檢驗必須在後端伺服器端（`api/getHistory.js`）進行雙向硬編碼校驗。

### 4.6 3D 虛擬成就徽章 (3D Achievements)
*   **業務用途**：管理員可上傳 3D 成就勳章 GLB / USDZ 文件，並綁定至特定勳章。用戶可在 profile.html 交互式旋轉、查看 3D 金屬徽章。
*   **主要檔案**：
    *   後端 API：`/api/admin.js?action=badges`
    *   前端：`admin_badges.html`, `profile.html`
*   **核心依賴**：`<model-viewer>` Web Component (由 Google 開源).
*   **安全紅線**：
    1.  **文件目錄防穿透**：管理員在掃描 3D 徽章模型時，路徑一律嚴格限定在 `/model/glb` 和 `/model/usdz` 目錄下。
    2.  **3D 重度模型優化**：所有 GLB 文件大小一律控制在 2MB 以內，嚴禁上傳過高面數、未壓縮紋理的模型，防止 PWA 在低配手機上渲染時，因 GPU 內存耗盡而導致應用程式崩潰閃退。

---

## 第五章：修改程式守則

當你著手在 CTRC HK 儲存庫中進行任何程式碼修改時，請嚴格遵守以下守則。這套守則適用於所有工程師與 AI Agent：

### 5.1 修改前的必經之路
在任何修改前，必須執行以下三步：
1.  **詳讀現有模組**：如果要修改里程，先看 `api/getHistory.js` 裡面的算分與結算邏輯；如果要修改 UI，先看 `css/main.css` 裡的全局 Glass UI 樣式變數。
2.  **不重複實作 (No Re-implementation)**：
    *   **嚴禁建立第二套系統**！例如，專案中已經有強大且運作良好的 `Mileage` 系統。你絕對不能因為嫌看舊程式碼麻煩，而隨手新建 `Mileage2`、`MileageNew`、`MileageManagerNew` 或是 `api/getHistory_new.js`。
    *   重複的程式碼是技術債的起點，也是 AI Agent 最容易犯的錯誤。任何重構，都必須在**既有程式結構內**進行修改與覆蓋。
3.  **遵循既有介面協定**：如果你需要對 API 新增欄位，請保持向後相容。例如：`api/getHistory` 返回的 `gpx_track` 欄位，既可能是 GeoJSON 字串，也可能是經緯度座標陣列，新寫的程式碼必須**同時相容這兩種格式**。

### 5.2 程式碼清理
*   嚴禁殘留無用的註解（如 `// test1`, `// todo: delete`）與 `console.log`。所有的除錯紀錄，應在提交前徹底清理乾淨。
*   如果修改了某個 HTML 結構，必須同步修正其相應的 CSS 選擇器，不得殘留「孤兒樣式」。

---

## 第六章：UI 設計規範

CTRC HK 的介面是其靈魂所在。所有新頁面、新元件、新彈窗，都必須完美符合現有的 **Glass UI (玻璃擬態/微漸變)** 風格。不得自行創造異質風格。

### 6.1 視覺核心指標與規範

#### 6.1.1 玻璃擬態 (Glassmorphic Container)
*   **背景色 (Background)**：
    *   暗色模式：`rgba(18, 31, 20, 0.45)` 或 `var(--lg-glass-bg)`。
    *   淺色模式：`rgba(255, 255, 255, 0.12)` 或 `var(--lg-glass-bg-light)`。
*   **毛玻璃濾鏡 (Blur & Saturation)**：
    *   必須包含：`backdrop-filter: blur(16px) saturate(160%)` 與 `-webkit-backdrop-filter: blur(16px) saturate(160%)`。
*   **邊框與陰影 (Border & Shadow)**：
    *   邊框：`1px solid rgba(255, 255, 255, 0.18)` 或 `var(--lg-glass-border)`。
    *   陰影：`0 8px 32px rgba(0, 0, 0, 0.35)`。
    *   圓角：標準圓角為 `20px`（`--lg-radius`）。

#### 6.1.2 按鈕與互動元件 (Primary Buttons & Active Chips)
*   **按鈕字型與圓角**：
    *   所有 CTA 鍵必須是膠囊狀（Pill Shape, 圓角 `50px`）。
    *   字體加粗 `font-weight: bold`。
    *   必須具備點擊微小縮小動畫：加上 `.btn-click-effect` 類，在 `:active` 時調用 `transform: scale(0.96) !important`。
*   **黑金主題下的強對比原則 (Critical Contrast Rule)**：
    *   當使用者切換至金卡主題（`body.rank-gold`）時，系統會強制套用高對比規則。
    *   任何主按鈕（例如 `.app-ride-cta`, `.app-start-ride-btn`）、啟用的過濾標籤 (active chips)、以及等級徽章等。
    *   **必須嚴格顯示為：黑底（`#000000 !important`）搭配金黃字/金黃背景（`#d4af37 !important`）**。這是防止陽光反射下無法清晰查看、保證騎行安全的強制規定。

#### 6.1.3 圖標、字體與間距 (Icons, Fonts & Spacing)
*   **圖標**：一律採用 **FontAwesome 6** 圖標。禁止混合使用 FontAwesome 4、Material Icons 或自繪 SVG（除非特定地圖標記需要）。
*   **字體**：
    *   繁體中文版優先：`'新細明體', 'PMingLiU', sans-serif` 以保持傳統香港印刷質感。
    *   在 Standalone PWA 中，字型一律繼承系統無襯線字型，確保原生 App 般的高級感。
*   **間距與邊距 (Padding & Spacing)**：
    *   卡片內部 padding 一律為 `1.5em`。
    *   卡片與卡片間的 gap 一律為 `1.5em` (桌機) 或 `1em` (手機)。

---

## 第七章：CSS 規範

為了保證 Light / Dark / Black Gold 主題切換的流暢性與正確性，我們對 CSS 撰寫設定了極其嚴苛的限制。

### 7.1 禁止直接寫死色彩數值 (No Hardcoded Colors)
*   **嚴禁在 CSS 中寫死具體顏色代碼**（例如：`background: #ffffff`, `color: #000000`）。
*   必須全部替換為系統預設的 CSS Variable：
    *   背景色：`var(--app-bg-primary)` / `var(--app-bg-card)`
    *   主色調/強調色：`var(--app-accent)`
    *   主要文字：`var(--app-text-primary)`
    *   次要文字：`var(--app-text-secondary)`
    *   邊框顏色：`var(--app-border)`
*   **唯一的例外**：地圖特定專用線條（例如 900 路線在 `routes.json` 裡面定義的 `#990000`）在動態渲染時可直接使用，但該數值必須來自配置檔案。

### 7.2 三大主題的 CSS Variable 宣告

```css
/* 1. 暗綠主題 (PWA 預設模式) */
body.is-pwa {
    --app-bg-primary: #121f14;
    --app-bg-secondary: #1a2e1a;
    --app-bg-card: #1e3820;
    --app-bg-card2: #243824;
    --app-accent: #6dba65;
    --app-accent-light: #a8d8a0;
    --app-accent-bright: #4caf50;
    --app-text-primary: #e8f5e9;
    --app-text-secondary: #a8d8a0;
    --app-border: #2d4d2d;
}

/* 2. 淺綠主題 (Light Mode) */
body.is-pwa.app-light-theme {
    --app-bg-primary: #f5faf5;
    --app-bg-secondary: #eaf4ea;
    --app-bg-card: #ffffff;
    --app-bg-card2: #f0f8f0;
    --app-accent: #2e7d32;
    --app-accent-light: #388e3c;
    --app-accent-bright: #4caf50;
    --app-text-primary: #1b3a1f;
    --app-text-secondary: #2e7d32;
    --app-border: #c8e6c9;
}

/* 3. 尊貴黑金高對比主題 (rank-gold) */
body.rank-gold {
    --app-bg-primary: #000000;
    --app-bg-secondary: #000000;
    --app-bg-card: #3a3a3a;
    --app-bg-card2: #3a3a3a;
    --app-accent: #d4af37;
    --app-accent-light: #d4af37;
    --app-accent-bright: #d4af37;
    --app-text-primary: #d4af37;
    --app-text-secondary: #d4af37;
    --app-border: #5a5a5a;
}
```

### 7.3 GPU 加速與動畫
*   凡是使用 `transition` 的地方，必須明確指定屬性（例如：`transition: transform 0.2s ease`），**嚴禁使用 `transition: all 0.2s`**，這會導致極大的 repaint 開銷與行動端掉幀。
*   大範圍動畫應配合 `will-change` 屬性優化渲染樹，但在動畫結束後必須移除或克制使用。

---

## 第八章：JavaScript 規範

風格一致的 JavaScript 代碼是本專案保持零 Bug、易讀、高效率運作的核心。

### 8.1 函式與變數命名
*   **變數與函式**：一律使用駝峰命名法 (`camelCase`)。例如：`isStandaloneAppMode()`, `syncRideHistory()`, `userId`。
*   **類與組件**：採用帕斯卡命名法 (`PascalCase`)。例如：`NotificationManager`, `AntiCheatEngine`。
*   **常數**：採用全大寫蛇形命名法 (`UPPER_SNAKE_CASE`)。例如：`CACHE_TTL`, `MAX_SPEED_KMPH`。

### 8.2 非同步程式碼與 Fetch 請求
*   一律使用 `async / await` 語法，嚴禁寫出過多且難以維護的 `then / catch` 地獄。
*   所有的 `fetch` 請求都必須包裹在 `try...catch` 結構中。
*   **Bearer Token 驗證**：在進行任何與登入使用者狀態相關的 API 請求（特別是 `/api/user`, `/api/getHistory`, `/api/chat`）時，必須在 Request Header 中主動帶入 Token。
    ```javascript
    const token = localStorage.getItem('accessToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    ```

### 8.3 錯誤處理與嚴格除錯 (Strict Logging)
*   請不要吞掉任何 Exception。在 `catch(e)` 中至少應有 `console.warn` 或 `console.error`。
*   生產環境的錯誤，可透過系統統一的 UI Modal 回饋給使用者，但後台 log 必須保留。

### 8.4 瀏覽器持久化儲存 (Storage) 的管理
*   `localStorage` 只允許儲存以下關鍵系統變數，其餘與臨時狀態相關的值一律使用 `sessionStorage` 或記憶體變數：
    *   `accessToken`：JWT Token。
    *   `user`：登入使用者的快取基本資料 JSON。
    *   `appTheme`：`'dark' | 'light' | 'auto'`。
    *   `appLang`：`'zh' | 'en'`。
    *   `unsyncedRides`：離線未同步的騎行記錄。

---

## 第九章：效能規範

這是一本必須牢記於心的工程「減碳指南」。行動裝置（特別是舊款 iPhone）對效量極其敏感。

### 9.1 避免 DOM 重建與過度重繪 (Repaint)
*   當需要更新列表（如 Forum 的回覆、Chat 的歷史訊息）時，**嚴禁每次都清除整個容器 (`container.innerHTML = ''`) 並重新建立所有 DOM 節點**。這會造成巨大的記憶體抖動與介面閃爍。
*   應優先使用 `DocumentFragment` 進行節點批量附加，或者直接比對資料，僅更新被修改的特定 DOM 欄位。

### 9.2 Leaflet 地圖的生命週期管理 (Map Recycle)
*   **地圖重複初始化（Multiple Inits）是造成 PWA 記憶體洩漏與卡頓的頭號殺手**。
*   在 SPA 頁面切換或重新渲染時，必須使用全域狀態 `window.PWA_MAPS_INITED` (一個全域 `Set`) 作為守衛，確保地圖只會初始化一次。
*   當要卸載地圖頁面時，必須顯式呼叫 `map.remove()` 並將地圖物件置空 `map = null`，確保垃圾回收。

### 9.3 限制重複 API 請求 (API Deduplication)
*   避免在多個組件 DOMContentLoaded 中各自 Fetch 同一個 API。
*   對於不常變動的資料（如路線圖籍 `routes.json`），應在 `js/main.js` 中實現全局緩存，設置 1 小時 (TTL) 的失效機制，並將資料快取於 `localStorage` 中。

### 9.4 無限定時器 (Timer) 的釋放
*   凡是在實時導航、多人房或 HUD 中使用 `setInterval`, `requestAnimationFrame` 或 `navigator.geolocation.watchPosition` 的邏輯。
*   當使用者離開該功能頁面或關閉彈窗時，**必須徹底呼叫 `clearInterval()`, `cancelAnimationFrame()` 或 `navigator.geolocation.clearWatch()` 釋放硬體資源**。否則，後台定時器會源源不斷地消耗騎士的手機電量。

---

## 第十章：PWA 規範

PWA 是 CTRC HK 提供給車友的終極體驗載體。PWA 的生命力來自其穩定與離線工作的能力。

### 10.1 Service Worker 與 Safari 的特別護航
*   Safari (iOS) 是 PWA 系統最容易出現異常的環境。
*   在我們的 `sw.js` 中，引入了針對 Safari 的特別防禦邏輯，避免在離線模式或 standalone 狀態切換時，出現無限重定向迴圈或「Failed to Fetch」報錯。
*   **離線快取策略**：
    *   對於靜態資源（CSS, JS, 圖片, HTML），採用 **Cache First** 策略，直接由 Service Worker 攔截並返回。
    *   對於動態 API（/api/user 等），採用 **Network First** 策略。若網路不通，自動回退至本地 localStorage 快取的上一次正常快照。

### 10.2 預防休眠：Screen Wake Lock API
*   當騎士進行 active 導航 (`nav.html`) 或騎行追蹤 (`ride.html`) 時，如果手機螢幕在中途自動熄滅，會造成 GPS 信號遺失、音樂暫停等嚴重問題。
*   適當防範：進入騎行或導航狀態後，必須立刻嘗試獲取 `navigator.wakeLock`。
*   在 `visibilitychange` 事件發生（例如使用者將 PWA 切到後台又切回前台）時，必須**自動重新請求 Wake Lock**，因為系統會在前台切換時自動釋放鎖。

### 10.3 Background 限制與 GPS 連續性
*   在手機鎖屏或進入後台時，瀏覽器對 JS 的定時器與定位追蹤會施加極其嚴厲的限流 (Throttle)。
*   為保持 GPS 追蹤的連續性：
    1.  必須使用 `navigator.geolocation.watchPosition` 並開啟 `enableHighAccuracy: true`。
    2.  將心跳與紀錄時間戳記完全綁定於真實的作業系統時間，而非依賴軟體計數器 (`i++` 累加)。

---

## 第十一章：安全規範

儘管 CTRC HK 倡導開放、自由的騎行社群，但作為嚴肅的工程專案，底層的安全防線決不妥協。

### 11.1 API 安全防護 (Bearer Token)
*   所有機密 API 一律由 Server 驗證 JWT Token 的合法性。
*   不允許在 Vercel Serverless API 中信任客戶端傳遞的 `userId` 參數。在需要取得或更新用戶狀態時，必須在伺服器端通過 `authenticate(req)` 函式，直接從 `Authorization` 請求頭解析 JWT 中的安全 `userId` 作為查詢依據。

### 11.2 反作弊機制 (Anti-Cheat Engine)
*   為維護全港排行榜與香港挑戰賽的公信力，防止使用者利用開車、搭港鐵、或手動修改座標刷分。
*   `api/getHistory.js` 對所有上傳的 GPX/GeoJSON 軌跡實施嚴格的比對與審查：
    1.  **最大瞬時與平均速度限制**：任何點對點瞬時速度或整趟騎行的平均速度大於 **$45\text{ km/h}$** 的記錄，直接判定為交通工具作弊。此紀錄將標記 `anti_cheat = true`，扣除或不予發放當次 XP、里程幣獎勵。
    2.  **極短行程過濾**：小於 **$0.2\text{ km}$** 的騎行直接 voided（作廢），不予載入資料庫。
    3.  **模式排除**：自由騎行模式 (Free Mode) 雖然累積里程，但嚴禁計入 30km/60km/100km 的香港挑戰賽勳章累計中，必須通過真實的路線圖籍引導完成。

### 11.3 資料庫安全 (RLS Constraints)
*   Neon Database PostgreSQL 必須啟用 Row Level Security (RLS)。
*   非管理員帳號，僅允許 `SELECT`, `UPDATE`, `DELETE` 擁有者欄位為其自身 `user_id` 的資料列。
*   `/api/admin.js` 必須具備安全角色檢測。只有 `user_role = 'admin'` 的帳號，才能訪問和調用管理控制面板相關的操作。

---

## 第十二章：Git Commit 規範

為了保證極少維護者的專案在回溯歷史時一目了然，所有開發者（與 AI Agent）提交的 Commit 必須符合 **Conventional Commits 規範**。

格式如下：
```
<type>: <subject>

<body>
```

### 12.1 支援的類型 (Type Definitions)
*   `feat`: 新增一項新功能（例如：多人房支援密碼加密、加入新的 3D 徽章）。
*   `fix`: 修復了一個 Bug（例如：修復了 Leaflet 3D 高度重繪時白屏的問題、解決了 Wallet logoURL 的本機報錯）。
*   `refactor`: 重構程式碼，既不修復 Bug 也不新增功能。
*   `docs`: 僅修改文檔（例如：完善本開發指南）。
*   `perf`: 旨在提升系統運行速度、記憶體回收或減電耗的修改。
*   `style`: 不影響程式碼本質邏輯的格式/樣式修改（例如：修整對齊、補齊分號、調整 theme variables 的順序）。
*   `test`: 新增或修改測試案例。
*   `build`: 影響建置系統、Vercel 部署設定或外部套件依賴的變更。

---

## 第十三章：Code Review Checklist (審查清單)

本章列出整整 80 項工程審查清單。所有開發者和 AI Agent 在發起代碼合併前，必須對照此清單逐一進行自我評估，確保全綠。

### A. 全局與定位 (1 - 10)
1. [ ] 修改是否維持了專案極簡、不堆砌抽象層的原則？
2. [ ] 是否存在為單一功能添加多層封裝或不必要設計模式的情況？
3. [ ] 程式碼是否可讀，變數和函式名稱是否見名知意？
4. [ ] 是否存在為炫技而寫的「天書」程式碼？
5. [ ] 是否存在殘留的調試代碼、無效註解或 `console.log`？
6. [ ] 是否修改了不屬於本次任務範圍的其他歷史代碼？
7. [ ] 是否確保不變更底層穩定的數據庫結構設計？
8. [ ] 修改後的代碼，其依賴庫數量是否保持最低？
9. [ ] 新增邏輯是否與 CTRC HK 目前將軍澳示範區定位相符？
10. [ ] 本次代碼是否經過了雙向審核和詳細測試？

### B. UI 與玻璃擬態規範 (11 - 20)
11. [ ] 新增的 UI 組件是否嚴格符合 Glassmorphic 玻璃擬態樣式？
12. [ ] 容器是否設置了 `backdrop-filter: blur(16px) saturate(160%)` 及其 Webkit 前綴？
13. [ ] 玻璃容器的背景色是否使用 CSS Variable（如 `var(--lg-glass-bg)`），而非寫死？
14. [ ] 新增的按鈕是否全部採用膠囊狀（圓角 `50px`）設計？
15. [ ] 所有的 primary button 是否都添加了 `.btn-click-effect`（點擊縮小至 `0.96`）？
16. [ ] 是否存在多種字型混用，破壞了原本系統字型體系的情況？
17. [ ] 新增的圖標是否全數來自 FontAwesome 6？
18. [ ] 卡片之間的間距 (Gap) 是否統一為 1em (行動端) / 1.5em (桌面端)？
19. [ ] UI 的 Z-index 設置是否合理，是否會遮擋 HUD 控制項或報站通知？
20. [ ] 是否存在會干擾騎士點擊的隱藏點擊層 (transparent blocking div)？

### C. 淺色、深色與黑金主題自適應 (21 - 30)
21. [ ] 新增的 CSS 是否百分之百使用 CSS Variables？
22. [ ] 是否存在寫死的十六進制顏色（如 `#fff`、`#000`、`#d4af37`）？
23. [ ] 新 UI 在淺色主題下（`body.app-light-theme`）文字對比度是否符合無障礙閱讀標準？
24. [ ] 新 UI 在深色主題下是否有合適的發光邊框與高階層感？
25. [ ] 新 UI 在金卡「黑金極簡主題」（`body.rank-gold`）下是否完美自適應？
26. [ ] 在黑金主題下，主按鈕與 active chips 是否被強制渲染為高對比黑底（`#000 !important`）和金黃字/金黃背景（`#d4af37 !important`）？
27. [ ] 是否經過了手動切換 Light/Dark 模式測試，確認新組件不會殘留舊主題的背景？
28. [ ] 主題切換邏輯是否持久化寫入了 `localStorage`？
29. [ ] 地圖在黑金模式下的流光線條，其顏色是否動態讀取了黃金配色變數？
30. [ ] 頁面切換時，主題是否會發生 0.5 秒的「色彩閃爍」？

### D. JavaScript 工程規範與語系控制 (31 - 40)
31. [ ] 所有命名是否嚴格遵循駝峰命名法 (`camelCase`)？
32. [ ] 是否將常數全數抽取並採用 `UPPER_SNAKE_CASE` 命名？
33. [ ] 所有 fetch 請求是否均採用 `async/await` 代替 Promise 鏈？
34. [ ] 所有的 fetch 請求是否包裹在 `try...catch` 中，並有合理的 UI 錯誤反饋？
35. [ ] 語言偏好（繁中 `zh` / 英文 `en`）是否成功持久化在 `localStorage` 的 `appLang` 中？
36. [ ] 是否保證 standalone 模式下 app-only 的頁面（如 `ride.html`）不會被語言重定向邏輯強制跳轉到 Web index？
37. [ ] 語系跳轉邏輯是否經過測試，確認不會在首頁 and 網誌頁面造成無限重定向循環？
38. [ ] 對於不常變化的動態數據（如 routes），是否採用快取與動態覆寫機制，避免重複請求？
39. [ ] 是否使用了嚴格模式的變數宣告（`let`, `const`），禁止不帶 `var/let/const` 的全域污染？
40. [ ] 是否在 JS 中避免了 `eval()`、`document.write()` 等高危、低效的寫法？

### E. 地圖與導航 HUD (41 - 50)
41. [ ] 在騎行頁面中，是否使用 Leaflet (CartoDB Tiles) 代替了高耗電的 Mapbox GL，以提高穩定性？
42. [ ] 自由模式開啟時，是否完全繞過了耗時的網路數據請求，實現 3 秒內極速加載？
43. [ ] 在頁面 visibility 切換後，是否在 `pwa-page-show` 事件觸發 150ms 內調用了 `map.resize()` / `map.invalidateSize()`，防止地圖破碎白屏？
44. [ ] 當使用者時速低於 3 km/h 時，地圖朝向是否鎖定在當前路段方向上，徹底杜絕原地打轉？
45. [ ] 是否對 GPS 定位誤差大於 50 米的核心坐標進行了合理過濾與降噪吸附？
46. [ ] 偏離路線（Off-route）警告是否採用 Turf.js 的 50 米緩衝區計算，而沒有頻繁誤報？
47. [ ] 地圖上繪製的麵包屑軌跡（Breadcrumb Path）是否隨 GPS 移動動態增加，且點數不超過 2000 點以防卡死？
48. [ ] 語音報站是否支持離線播放，音訊檔案是否均放在本地緩存目錄中？
49. [ ] 導航 HUD 的 Z-index 是否按「頂層導航指示-左側 ETA/時速-底層控制面板」合理排布？
50. [ ] 地圖關閉或切換頁面時，是否主動註銷了 Leaflet 實例，清空相關的 Layer 變數？

### F. PWA 與 Service Worker 核心 (51 - 60)
51. [ ] 修改後的靜態檔案路徑是否已同步登記在 Service Worker (`sw.js`) 的 Cache List 中？
52. [ ] 是否針對 Safari (iOS) 的 Standalone 模式進行了 Fetch 錯誤降級與不重定向防禦？
53. [ ] 騎行或導航啟用時，是否獲取了 `navigator.wakeLock` 防止手機鎖屏熄屏？
54. [ ] 在頁面 `visibilitychange` 返回前台時，是否重新請求了 Wake Lock 鎖？
55. [ ] 當網絡離線時，頁面是否能優雅地展示已快取的靜態內容，而沒有顯示「無網路連接」恐龍白頁？
56. [ ] 本地推送（Local Notifications）是否在 50 米報站時能正確觸發，並支援 iOS PWA 獨立應用？
57. [ ] PWA bottom navigation bar (`#app-bottom-nav`) 是否設置了 iOS 「Liquid Glass」流體玻璃效果？
58. [ ] bottom nav 的高度是否考慮了 `safe-area-inset-bottom`，以防與系統 Home Bar 重疊？
59. [ ] 是否為 `.app-only` 的元素在 PWA Standalone 模式下強制設置了 `display: block !important`？
60. [ ] 離線紀錄的騎行軌跡，是否能在網絡恢復時自動背景調用 `syncRideHistory()` 同步？

### G. 安全與防作弊防禦 (61 - 70)
61. [ ] 所有需要用戶登入的 API，是否均在後端對 JWT 進行了 `authenticate` 提取與合法性檢核？
62. [ ] 登入 Token 是否過濾了前後引號，防範 `null` 字符串帶來的非法授權漏網？
63. [ ] 騎行歷史結算 API (`api/getHistory`) 是否執行了最大瞬時速度限制（嚴禁大於 45 km/h）？
64. [ ] 自由騎行或不合規的紀錄，是否嚴格排除在 30km/60km/100km 香港挑戰賽的進度累積外？
65. [ ] 960 號路線（Route 960）是否被正確排除在挑戰賽結算資格之外？
66. [ ] 資料庫操作是否全數限制於 RLS 安全約束中，防止橫向越權？
67. [ ] 後台徽章指派與文件讀取 API 是否限制了僅 `user_role = 'admin'` 的帳號可調用？
68. [ ] 寫入資料庫的使用者輸入內容（如網誌投稿、論壇回覆、聊天訊息），是否經過了防 XSS 消毒？
69. [ ] 登入密碼等敏感數據是否絕對不在前端 local storage 中明文儲存？
70. [ ] 是否存在任何可以通過前端模擬心跳直接刷分、刷 XP、刷 Coins 的機制漏洞？

### H. 效能與系統穩健性 (71 - 80)
71. [ ] 是否避免了定時器心跳暴增、多人房 WebSocket 重複連接的問題？
72. [ ] 在頁面載入時，是否存在不必要的阻塞型、高耗時第三方 JS 的載入？
73. [ ] WalletWallet 卡包生成 API 的 logoURL 解析是否動態適應 localhost 與生產環境？
74. [ ] 3D 虛擬徽章的加載，是否使用了延遲載入 (lazy-load) 策略，防止一進 Profile 就卡頓？
75. [ ] 導出的 1080x1350 高解析度軌跡海報，是否能在主流手機上順利生成且保持透明背景、流光線條？
76. [ ] 連線異常時，多人房的位置同步是否會優雅降級為本機模擬，且不中斷騎士當下的騎行？
77. [ ] 是否嚴格避免了任何形式的「第二套 Mileage / Tasks / Auth / Theme」重複系統重寫？
78. [ ] 專案核心文件（如 `AGENTS.md`、`README.md`、`MILEAGE.md`）中的約定規範，是否被本代碼變更嚴格遵循？
79. [ ] 行動端測試中，頁面在滑動和切換時是否保持 60 FPS？
80. [ ] 本次 Commit 的 message 是否符合 Conventional Commits 格式規範？

---

## 第十四章：AI Agent 開發守則

本章是專門為所有訪問和修改 CTRC HK 儲存庫的 **AI Agent（包括 Google Jules, Claude Code, Cursor, ChatGPT, Gemini, Copilot 等）** 設定的嚴格操作邊界與行為守則。

### 14.1 核心行為守則
當 AI Agent 接收到修改本專案的指令時，必須**百分之百嚴格執行**以下規範：

1.  **先讀後寫 (Read Before Write)**：
    *   在任何修改前，必須完整閱讀並解析本專案根目錄的 `README.md`、`docs/Product/PRODUCT_SPEC.md`、`UPDATELOG.md` 以及**本文件**。
    *   AI 代理必須確保對 CTRC HK 的整體專案願景、技術約束、安全設計與 UI 體系有透徹的理解後，方可開啟程式碼變更。
2.  **不變更核心價值與產品理念 (Respect the Philosophy)**：
    *   CTRC HK 的底層是以「單車徑優先」、「三軌制低碳經濟」、「遊戲化保級里程」與「免費 PWA 卡包」為核心設計。
    *   嚴禁 AI 代理自行發明或加入不符合專案戰略的設計（例如：強行加入廣告、將里程滾動算法改為永久累積、將將軍澳特定路線標籤改為其他非本港區域）。
3.  **嚴禁引入大型第三方框架 (Framework Sentry)**：
    *   嚴格禁止 AI 代理自行在 `package.json` 中引入 React, Vue, Svelte, Tailwind CSS, Bootstrap, Material-UI, NestJS, Prisma 或任何需要複雜建置步驟的大型框架。
    *   我們只接受使用瀏覽器原生 Web API、簡明流暢的 Vanilla JS、以及本專案中已登記且維護的原生 Leaflet, Turf.js 與 Vercel Serverless Helpers。
4.  **嚴禁移除現有功能或大面積重寫 (Preserve & Protect)**：
    *   嚴格禁止 AI 代理因為「看不懂舊有邏輯」或「想要簡化程式碼」，而直接將原有的多人房間、Wallet 卡包、Anti-Cheat 等核心健壯模組進行大面積刪除與重寫。
    *   你必須在**保持現有架構、遵循原有介面 API、相容原有資料格式**的前提下進行細部修復與功能擴充。
5.  **嚴格執行本地驗證 (Local Verification)**：
    *   在每次程式碼修改後，AI 代理必須使用唯讀工具（如 `read_file`）或建置工具，確認變更後的程式碼語法正確、沒有遺漏閉合括號、沒有未定義變數。
    *   在向人類開發者提交前，AI 代理必須調用測試與預提交驗證工具（`pre_commit_instructions`），確認所有的 Pre-commit 檢查均已綠燈通過。

---

## 第十五章：最後原則 (The Ultimate Philosophy)

CTRC HK 的開發哲學可以凝聚為一句至高無上的指導方針：

> **「每一次代碼修改，都應當讓騎士在路上更加安全、騎行更加流暢、介面更加簡單易用。」**

這不僅僅是一個單車 App，這是我們為香港智慧城市與可持續低碳出行貢獻的一份力量。
*   **功能可以慢慢增加**，但我們絕不允許一個不穩定、易崩潰、容易耗盡騎士手機電量、或者在烈日下無法閱讀的系統上線。
*   **穩定性與流暢度，永遠排在第一位。**

當你在深夜敲下最後一行程式碼，並準備發起提交時，請閉上眼睛想像一下：

*「在將軍澳海濱長廊，一輛單車正在黃昏下疾馳。騎士將手機卡在車把的支架上，手機正透過 PWA 顯示著你寫的 HUD 儀表。汗水滴落在屏幕上，風聲在耳邊呼嘯。你寫的每一行程式碼、你優化的每一個 0.2 秒動畫、你防禦的每一個 GPS 漂移，都在默默守護著這名騎士前行的路。」*

請帶著這份對騎行的敬畏，開始你的開發之旅吧。

---

## 第十六章：追加技術指標備忘 (Additional Tech Specs Appendix)

為了讓未來開發者與高階 AI 代理（如 Google Jules）在實裝時有精確的程式碼參考，本章特別追加收錄了系統關鍵模組的技術規格：

### 16.1 365天滾動里程 SQL 實作模式
```sql
-- 用於 api/getHistory.js 計算用戶滾動里程之參考 SQL 結構
SELECT COALESCE(SUM(distance), 0) AS rolling_mileage
FROM user_rides
WHERE user_id = $1
  AND created_at >= NOW() - INTERVAL '365 days'
  AND anti_cheat = false;
```

### 16.2 UI 與主導航 Apple Safari Safe-Area 護航規則
```css
/* 嚴格防範 PWA 在 Safari 獨立視窗下 bottom navigation 遭遮擋 */
#app-bottom-nav {
    padding-bottom: calc(0.5em + env(safe-area-inset-bottom)) !important;
    padding-top: 0.5em !important;
}
```

### 16.3 報站 Notification 本地音效回退緩存定義
```javascript
const STOPS_AUDIO_FALLBACK = {
    "tko-waterfront": "audio/announcement_tko_waterfront.mp3",
    "po-lam-station": "audio/announcement_po_lam.mp3",
    "hang-hau-station": "audio/announcement_hang_hau.mp3"
};
```

CTRC HK 開發團隊始終秉持這份對程式細節與極致效能的苛求。遵循本指南，是每一位卓越開發者對這座城市與每一位騎士最真摯的致敬。

---
&copy; 2026 CTRC HK (香港城市運輸單車) 核心工程委員會. 版權所有。
