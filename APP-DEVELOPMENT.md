# CTRC HK 騎行 App 開發探討（遊戲化 PWA 版本）

> 本文件探討 CTRC HK 官方 App 的開發方向，以遊戲化玩法為核心設計理念，  
> 並採用 **PWA（漸進式 Web App）** 作為首要技術方案，利用現有前端技術零成本落地。

---

## ✅ 常見問題：三個關鍵問題

### Q1：App 的開發方式跟現在的網頁一樣嗎？

**是的，完全一樣。**

PWA 就是把現有網頁「升級」為可安裝的 App，不需要從零開始開發新程式：

| 現有網站 | PWA App |
|---------|---------|
| 相同的 HTML / CSS / JavaScript | ✅ 完全複用 |
| 相同的 Vercel API 端點 | ✅ 完全複用 |
| 相同的資料庫（Neon/PostgreSQL） | ✅ 完全複用 |
| 相同的 JWT 用戶認證 | ✅ 完全複用 |
| 相同的 Google 登入 | ✅ 完全複用 |
| 額外：GPS 定位 + 推送通知 + 離線支援 | 🆕 新增功能 |

用戶在手機 Safari 或 Chrome 打開網站後，點選「加至主屏幕」，即可像使用 App 一樣使用，無需上架 App Store。

### Q2：我可以繼續使用現在的網域嗎？

**當然可以，PWA 就是在 `ctrchk.com` 上運行的。**

- **網域不變**：仍然是 `https://ctrchk.com`
- **Vercel 部署不變**：繼續使用現有的 Vercel 項目
- **無需額外費用**：不需要 App Store 開發者帳號（省 $99/年）
- **即時更新**：修改代碼後立即生效，用戶無需更新 App

### Q3：可以幫我開發嗎？

**已開始開發！** 以下是本次已完成的第一階段工作：

#### ✅ 已完成（第一階段 PWA 基礎）

- **Web App Manifest** (`manifest.json`) — 讓用戶「加至主屏幕」
- **Service Worker** (`sw.js`) — 離線緩存，支援無網絡訪問路線頁面
- **PWA 安裝提示** (`js/pwa.js`) — 自動顯示「安裝 App」橫幅
- **Leaflet.js 地圖** — 在路線詳情頁顯示 GPX 路線圖
- **站點標記** — 地圖上顯示各站點編號和名稱
- **GPS 追蹤** — 實時顯示用戶位置，接近站點時觸發通知
- **報站提示** — 接近站點 50 米內發送推送通知（iOS 16.4+ / Android）
- **路線靜態數據** (`routes.json`) — 含站點 GPS 坐標，供地圖使用
- **騎行記錄提交 API** — `POST /api/getHistory` 支援提交騎行數據（含 XP 計算）
- **遊戲進度 API** — `GET /api/get-user` 現在回傳等級、XP、里程幣
- **儀表板遊戲卡片** — 顯示等級、XP 進度條、里程幣餘額
- **豐富騎行歷史顯示** — 顯示路線名稱、距離、時間、速度、XP
- **資料庫架構** — 新增遊戲進度表、路線解鎖表、等級配置表

#### ✅ 已完成（第二階段 PWA 優化）

- **App Logo 修正** — `header.html`、`en/header.html` 及 `manifest.json` 的 Logo 改為使用 `icon-192.png`，不再使用 `bike-commute.jpg`
- **App 模式隱藏頂部導航欄** — `header.html` / `en/header.html` 加上 `web-only` CSS 類別，在 App 安裝模式下自動隱藏頂部 Header，避免冗餘佔位
- **增強底部導航欄** (`js/pwa.js`) — 新增「更多」(More) 第五頁籤，點擊後展開底部浮層，包含：關於我們、會員計劃、部落格、聯絡我們、下載 App 教學、語言切換，以及動態顯示登入／登出按鈕
- **修復儀表板騎行歷史 Server 500** (`api/_db.js`) — 自動遷移腳本新增 `cycling_history` 擴充欄位（`route_id`、`duration_minutes`、`avg_speed_kmh`、`stops_reached`、`xp_earned`、`source`），以及 `user_game_profile`、`routes_config`、`level_config` 遊戲化資料表，確保 `GET /api/getHistory` 不因缺少欄位而返回 500 錯誤
- **修復「我的」頁面底部導航消失** (`profile.html`) — 補充缺少的 `<script src="/js/pwa.js"></script>`，確保 App 模式下「我的」頁面正常顯示底部導航欄
- **新增「下載 App」頁面** (`download-app.html`) — 獨立安裝教學頁面，含 iOS (Safari) 與 Android (Chrome) 分步教學、功能介紹、常見問題，以及支援一鍵安裝按鈕（`beforeinstallprompt` API）
- **網頁導航新增「下載 App」連結** — `header.html` / `en/header.html` 導航欄加入醒目的「下載 App」／「Get App」連結，方便網頁用戶找到安裝教學

#### ✅ 已完成（第三階段 遊戲化 App 正式開發）

- **移除 App 內「下載 App 教學」** (`js/pwa.js`) — 「更多」浮層移除「下載 App 教學」連結，App 內不再顯示安裝教學
- **修復部分頁面底部導航消失** (`blog.html`, `blog_post.html`, `forum.html`, `forum_topic.html`, `en/blog.html`, `en/contact.html`, `en/membership.html`) — 補充缺少的 `<script src="/js/pwa.js"></script>`
- **已登入時自動跳轉至儀表板** (`login.html`) — 若已有 `accessToken` 則直接 `replace('/dashboard')`，網頁及 App 均適用
- **App 底部導航：未登入顯示「登入」按鈕** (`js/pwa.js`) — 未登入時將「儀表板」Tab 替換為「登入」Tab，登入後恢復顯示「儀表板」
- **App 預設啟動頁改為儀表板** (`manifest.json`) — `start_url` 改為 `/dashboard`；已登入用戶開啟 App 直接進入儀表板，未登入則自動跳轉至登入頁
- **改善儀表板跳轉體驗** (`dashboard.html`) — 移除未登入時的 `alert()` 提示，改為直接靜默跳轉至登入頁
- **全新 20 級積分系統** (`database-schema.sql`, `api/_db.js`, `dashboard.html`):
  - **Level 1 僅開放路線：900、900A、966**
  - XP 要求由極低開始，指數增長（Lv1→2 只需 80 XP，Lv19→20 需 4700 XP）
  - 大約每 3 級解鎖一條新路線（Lv4: 914/966A → Lv7: 910/914B → Lv10: 914H/920 → ...）
  - **每 5 級更換稱號**：Lv1–5 新手騎士 → Lv6–10 城市騎手 → Lv11–15 路線達人 → Lv16–20 都市傳奇

#### 🔜 下一步（第三階段）

- 路線解鎖系統 UI（在路線頁顯示鎖定狀態、解鎖等級要求）
- 里程幣購買特別路線
- 騎行結束動畫（XP 獎勵、升級動畫）
- 完善各路線站點的實地 GPS 坐標
- 語音報站（Web Speech API）

#### ✅ 已完成（第四階段 港島海濱部）

- **新增港島海濱部 (HKI)** — 全新部門，負責港島北岸各海濱單車路線
  - 推廣期解鎖費用：🪙20 里程幣（原價 400 里程幣）
  - 解鎖部門後，以下路線免費騎行

- **路線 7E / 7W 路線資料** — 詳見 [README.md 第 17.5 節](./README.md#175-港島海濱部路線資料)
  - 完成獎勵：🏆 150 XP + 🪙5 里程幣（無到站 XP）

- **部門解鎖系統** — 新增以里程幣解鎖部門的機制
  - 資料庫：`department_config`、`user_unlocked_departments` 表
  - API：`POST /api/getHistory?action=purchase-department`
  - 前端：路線選擇頁新增部門解鎖介面

- **管理員路線管理** (`admin.html`) — 新增路線管理標籤
  - 可即時調整路線的里程幣解鎖優惠價格
  - 可管理部門解鎖的推廣期設定（開啟/關閉推廣、調整推廣價格）

- **修復 GPS 漂移累積距離** (`ride.html`) — 設定最小移動距離門檻（3 米），避免 GPS 細微漂移不斷累積騎行距離

- **修復單車徑導航自訂起點終點** (`nav.html`) — 新增「使用目前位置」選項，讓用戶可以選擇目前 GPS 位置作為起點或終點

---

## 目錄

1. [遊戲化設計理念](#1-遊戲化設計理念)
2. [站點式路線設計](#2-站點式路線設計)
3. [核心功能清單](#3-核心功能清單)
4. [技術選型：為何選擇 PWA](#4-技術選型為何選擇-pwa)
5. [與現有網站整合](#5-與現有網站整合)
6. [需要新增的 API 端點](#6-需要新增的-api-端點)
7. [資料庫變更](#7-資料庫變更)
8. [路線導航實現方案](#8-路線導航實現方案)
9. [儀表板同步方案](#9-儀表板同步方案)
10. [開發路線圖](#10-開發路線圖)
11. [開放問題與待決定事項](#11-開放問題與待決定事項)
12. [單車徑導航可行性探討](#12-單車徑導航可行性探討)
    - [12.1 背景：現有遊戲化功能 vs. 實用導航需求](#121-背景現有遊戲化功能-vs-實用導航需求)
    - [12.2 香港單車徑概覽](#122-香港單車徑概覽)
    - [12.3 技術可行性分析](#123-技術可行性分析)
    - [12.4 實現方案比較](#124-實現方案比較)
    - [12.5 單車徑導航 UI 設計](#125-單車徑導航-ui-設計)
    - [12.6 與現有遊戲化系統整合](#126-與現有遊戲化系統整合)
    - [12.7 資料庫擴充（導航模式）](#127-資料庫擴充導航模式)
    - [12.8 技術挑戰與風險](#128-技術挑戰與風險)
    - [12.9 建議實施步驟](#129-建議實施步驟)
    - [12.10 結論](#1210-結論)
    - [12.11 目標升級：超越傳統導航的車道級單車徑導航](#1211-目標升級超越傳統導航的車道級單車徑導航)
    - [12.12 將軍澳單車徑網絡詳覽（首階段目標）](#1212-將軍澳單車徑網絡詳覽首階段目標)
    - [12.13 零成本完整技術方案分析](#1213-零成本完整技術方案分析)
    - [12.14 車道級視覺化實現技術](#1214-車道級視覺化實現技術)
    - [12.15 首階段實施計劃（將軍澳）](#1215-首階段實施計劃將軍澳)
    - [12.16 更新結論（包含車道級導航目標）](#1216-更新結論包含車道級導航目標)

---

## 1. 遊戲化設計理念

### 核心玩法概念

App 設計成**類遊戲模式**，以吸引更多用戶持續使用並探索路線：

#### 路線解鎖機制
- 新用戶**只能看到極少數路線**（如 2-3 條入門路線）
- 路線並非一開始全部開放，需要透過騎行**逐步解鎖**
- 這種「稀缺感」令用戶更有動力去騎行

#### 經驗值（XP）系統
- 每次完成騎行獲得 XP（經驗值）
- XP 累積到一定數量可以**升級**
- 不同路線、距離、難度給予不同 XP 獎勵

```
完成一次騎行  →  獲得 XP
XP 達到閾值  →  升級（Level Up）
升級獎勵：   →  新路線解鎖 ＋ 遊戲內貨幣
```

#### 遊戲內貨幣系統
- 升級時獲得一定數量的**遊戲內貨幣**（如「里程幣」）
- 貨幣可用來**購買特別路線**（獨家路線、挑戰路線）
- 特別路線無法直接騎行解鎖，只能用貨幣購買，增加稀缺性

#### 升級獎勵範例

| 等級 | 稱號 | 解鎖內容 | 獲得貨幣 |
|------|------|---------|---------|
| Lv.1 | 新手騎士 | 入門路線（2 條） | — |
| Lv.2 | 街坊騎手 | 新增 1 條路線 | 100 里程幣 |
| Lv.3 | 區域探索者 | 新增 2 條路線 | 200 里程幣 |
| Lv.5 | 城市騎士 | 特別挑戰路線 | 500 里程幣 |
| Lv.10 | 都市傳奇 | 全路線解鎖 | 1000 里程幣 |

> 💡 遊戲化玩法可大幅提升用戶留存率，令騎行本身變得更有趣、更有目標感。

---

## 2. 站點式路線設計

### 像坐巴士一樣的路線體驗

CTRC 路線採用**一站一站的站點設計**，類似巴士路線的運作模式：

```
路線 900 — 市區海濱線
  🚏 站1：寶琳（新都城二期）  ← 起點
  🚏 站2：坑口單車公園
  🚏 站3：將軍澳南
  🚏 站4：調景嶺海濱
  🚏 站5：調景嶺彩明        ← 終點
```

### 站點式導航功能

#### 實時報站
- App 會根據 GPS 位置，自動偵測用戶接近哪個站點
- 接近站點時發出**通知提示**（推送通知或振動）
- 螢幕上顯示：「即將到達：坑口單車公園」

#### 導航顯示
- 地圖上清晰標示所有站點（標號 + 站名）
- 顯示**下一個站點**方向箭頭
- 即時顯示「距下一站：xxx 米」

#### 語音報站（未來版本）
- 接近站點時自動語音播報站名（如：「前方：調景嶺海濱」）
- 類似巴士廣播的體驗

### 站點數據格式

```json
{
  "id": "900",
  "name": "市區海濱線",
  "stops": [
    { "order": 1, "name": "寶琳（新都城二期）", "lat": 22.3230, "lon": 114.2595 },
    { "order": 2, "name": "坑口單車公園",       "lat": 22.3168, "lon": 114.2610 },
    { "order": 3, "name": "將軍澳南",           "lat": 22.3052, "lon": 114.2640 },
    { "order": 4, "name": "調景嶺海濱",         "lat": 22.3015, "lon": 114.2685 },
    { "order": 5, "name": "調景嶺彩明",         "lat": 22.3005, "lon": 114.2730 }
  ]
}
```

---

## 3. 核心功能清單

### 必要功能（MVP）

| 功能 | 說明 |
|------|------|
| 用戶登入 | 使用現有 JWT / Google OAuth，與網站共用帳號 |
| 路線解鎖系統 | 初始只顯示少數路線，透過騎行逐步解鎖 |
| 站點式路線地圖 | GPX 疊加在地圖，並標示所有站點 |
| 實時 GPS 導航 | 用 GPS 追蹤位置，顯示距離下一站的距離 |
| 站點提示通知 | 接近站點時發出推送通知（iOS PWA 支援） |
| XP 與等級系統 | 騎行獲得 XP，累積升級，解鎖新路線 |
| 遊戲內貨幣 | 升級獲得里程幣，可購買特別路線 |
| 騎行記錄 | 記錄距離、時間、途經站點、開始/結束時間 |
| 儀表板同步 | 騎行結束後上傳數據至後台，網站儀表板可查閱 |

### 進階功能（未來版本）

| 功能 | 說明 |
|------|------|
| 語音報站 | 接近站點時自動語音播報站名（Web Speech API） |
| 離線地圖 | Service Worker 緩存地圖瓦片，無網絡亦可導航 |
| 成就徽章 | 完成特定路線或里程解鎖特別徽章 |
| 每日任務 | 每日挑戰路線，額外 XP 獎勵 |
| 排行榜 | 查看同路線其他騎手的里程排名 |
| Apple Watch / Wear OS | 在智慧手錶上顯示站點提示和騎行數據 |

---

## 4. 技術選型：為何選擇 PWA

### 技術方案比較

#### ✅ 推薦方案：PWA（漸進式 Web App）

```
優點：
  ✅ 完全免費 — 無需支付 App Store 上架費用（$99/年）
  ✅ 直接在現有網站上擴展，無需獨立 App 開發
  ✅ 與現有 HTML/CSS/JS 技術完全一致，無需額外學習
  ✅ 可以「加至主屏幕」，使用體驗接近原生 App
  ✅ iOS Safari（iOS 16.4+）已支援 GPS 定位 API
  ✅ iOS Safari（iOS 16.4+）已支援推送通知（可報站）
  ✅ Android Chrome 完整支援後台 GPS 和推送通知
  ✅ 即時更新 — 修改網站代碼立即生效，無需用戶更新 App

缺點：
  ❌ iOS 無法實現後台持續 GPS（螢幕熄滅後停止追蹤）
  ❌ 離線地圖緩存有容量限制
  ❌ 無法上架 App Store（用戶需手動「加至主屏幕」）
```

> 📱 **iOS PWA 現狀更新（2024 年起）**：
> - iOS 16.4 以後的 Safari 已支援 Web Push 通知（即報站提示可用）
> - iOS 的 Geolocation API 在前景模式下完全支援 GPS
> - 對於「一站一站導航」的使用場景，用戶通常保持螢幕開啟，後台 GPS 限制影響有限

#### 其他方案參考（日後視資源決定）

**React Native + Expo**
```
適合：正式 iOS + Android App，有後台 GPS 追蹤需求
費用：Apple Developer $99/年 + Google Play $25 一次性
時間：約 2-3 個月開發
```

**Flutter**
```
適合：一套代碼覆蓋 iOS、Android、Web
費用：同 React Native
時間：需學習 Dart 語言，約 3-4 個月
```

**原生 iOS/Android**
```
適合：有充足原生開發資源的情況
費用：最高（雙平台各自開發）
時間：約 6+ 個月
```

### 建議路線

```
第一階段：PWA（免費落地）
  → 現有網站加上 Service Worker + GPS API + 推送通知
  → 加入遊戲化系統（XP、等級、路線解鎖、里程幣）
  → 用戶「加至主屏幕」即可使用，無需上架

第二階段：React Native App（正式 App，視資源決定）
  → 完整 iOS + Android App
  → 後台 GPS 追蹤（螢幕熄滅亦能持續記錄）
  → 上架 App Store 和 Google Play
```

---

## 5. 與現有網站整合

### 現有可直接複用的資源

| 資源 | 說明 | 如何在 App 中使用 |
|------|------|-----------------|
| JWT 認證 | `POST /api/login`、`POST /api/google-auth` | App 登入後存儲 JWT token，後續 API 調用帶上 Bearer token |
| 用戶數據 | `GET /api/get-user` | 獲取用戶名、會員等級、XP、等級 |
| 騎行歷史 | `GET /api/getHistory` | 在 App 內顯示歷史紀錄及已完成站點 |
| GPX 路線文件 | `/gpx/*.gpx`（靜態文件） | App 直接讀取解析 GPX，疊加到地圖 |
| 路線數據 | `js/main.js` 中的 `routes[]` 陣列 | 抽取為獨立 JSON API，加入站點和解鎖條件 |
| 高級會員判斷 | `user_role === 'senior'` | 保留現有會員系統，遊戲等級為額外層 |

### 認證流程（PWA 端）

```
1. 用戶在 PWA 輸入電郵/密碼
   → POST /api/login
   → 獲得 JWT token（有效期 7 天）
   → 存儲於 localStorage（PWA）

2. 或使用 Google 登入
   → 調用 Google OAuth，獲得 id_token
   → POST /api/google-auth { idToken }
   → 獲得 JWT token

3. 後續所有 API 請求帶上：
   Authorization: Bearer <token>

4. Token 過期時自動跳轉登入頁
```

---

## 6. 需要新增的 API 端點

以下是 PWA 需要但現有網站尚未提供的 API：

### 6.1 路線數據 API（含站點信息）

```
GET /api/routes
GET /api/routes?id=900

作用：以 JSON 格式提供路線數據，含站點坐標及解鎖條件

回應範例：
[
  {
    "id": "900",
    "alias": "市區海濱線",
    "unlock_level": 1,           // 需要等級幾才能解鎖
    "unlock_cost": null,         // null = 騎行解鎖；數字 = 里程幣購買
    "xp_reward": 150,            // 完成此路線獲得的 XP
    "stops": [
      { "order": 1, "name": "寶琳（新都城二期）", "lat": 22.323, "lon": 114.259 },
      { "order": 2, "name": "坑口單車公園",       "lat": 22.316, "lon": 114.261 }
    ],
    "gpx": [
      { "label": "往寶琳", "file": "900寶琳.gpx" },
      { "label": "往調景嶺", "file": "900調景嶺.gpx" }
    ]
  }
]

注意：Vercel Hobby 目前已接近 12 個 Serverless Function 的上限，
      建議命名為 _routes.js（下劃線前綴，不計入函數數量）。
```

### 6.2 上傳騎行紀錄 API

```
POST /api/rides （需要 JWT 驗證）

請求體：
{
  "route_id": "900",
  "route_name": "市區海濱線",
  "ride_date": "2026-03-09",
  "start_time": "2026-03-09T09:00:00Z",
  "end_time": "2026-03-09T09:42:00Z",
  "distance_km": 5.5,
  "duration_minutes": 42,
  "avg_speed_kmh": 7.9,
  "stops_reached": [1, 2, 3, 4, 5],  // 已到達的站點編號
  "gpx_track": "..."                   // 可選：實際騎行 GeoJSON
}

回應：
{
  "success": true,
  "ride_id": 123,
  "xp_earned": 150,             // 此次騎行獲得的 XP
  "total_xp": 450,              // 用戶累計 XP
  "level": 3,                   // 用戶當前等級
  "level_up": true,             // 是否升級
  "coins_earned": 200,          // 升級獲得的里程幣（若有）
  "unlocked_routes": ["900A"]   // 升級後解鎖的新路線（若有）
}
```

### 6.3 用戶遊戲進度 API

```
GET /api/game-profile （需要 JWT 驗證）

回應：
{
  "level": 3,
  "xp": 450,
  "xp_to_next_level": 300,
  "coins": 350,
  "unlocked_routes": ["900", "914", "900A"],
  "completed_routes": ["900", "914"]
}
```

### 6.4 貨幣購買路線 API

```
POST /api/purchase-route （需要 JWT 驗證）

請求體：
{
  "route_id": "914H"
}

回應：
{
  "success": true,
  "coins_spent": 500,
  "coins_remaining": 100,
  "unlocked_route": "914H"
}
```

### 6.5 騎行紀錄詳情 API（擴展現有 getHistory）

```
GET /api/getHistory （現有，略作擴展）

目前回應：[{ ride_date, distance_km, route_name }]
建議擴展至：
[{
  id, route_id, route_name, ride_date,
  distance_km, duration_minutes, avg_speed_kmh,
  start_time, end_time, stops_reached, xp_earned
}]
```

---

## 7. 資料庫變更

### 擴展 cycling_history 資料表

```sql
-- 為 cycling_history 增加更多騎行詳情欄位
ALTER TABLE cycling_history
  ADD COLUMN IF NOT EXISTS route_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS stops_reached JSONB,          -- 已到達的站點列表
  ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0,  -- 此次騎行 XP
  ADD COLUMN IF NOT EXISTS gpx_track TEXT,               -- 可選：實際騎行 GeoJSON
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
  -- source: 'web' (手動輸入) | 'pwa' (PWA 自動上傳) | 'app' (原生 App) | 'gpx' (GPX 導入)

-- 新索引
CREATE INDEX IF NOT EXISTS idx_cycling_history_route_id
  ON cycling_history(route_id);
CREATE INDEX IF NOT EXISTS idx_cycling_history_start_time
  ON cycling_history(start_time);
```

### 新增遊戲進度資料表

```sql
-- 用戶遊戲進度（XP、等級、貨幣）
CREATE TABLE IF NOT EXISTS user_game_profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 已解鎖路線
CREATE TABLE IF NOT EXISTS user_unlocked_routes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  route_id VARCHAR(20) NOT NULL,
  unlock_method VARCHAR(20) NOT NULL,  -- 'level_up' | 'purchase' | 'default'
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

-- 路線定義（解鎖條件）
CREATE TABLE IF NOT EXISTS routes_config (
  route_id VARCHAR(20) PRIMARY KEY,
  unlock_level INTEGER NOT NULL DEFAULT 1,   -- 需要幾級才能解鎖（騎行解鎖）
  unlock_cost INTEGER,                        -- NULL = 免費騎行解鎖；數字 = 里程幣購買
  xp_reward INTEGER NOT NULL DEFAULT 100,     -- 完成此路線的 XP 獎勵
  is_special BOOLEAN DEFAULT FALSE            -- 是否為特別路線（只能購買）
);
```

### 等級升級配置

```sql
-- 等級所需 XP 及獎勵
CREATE TABLE IF NOT EXISTS level_config (
  level INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,    -- 升到此等級所需累計 XP
  coins_reward INTEGER DEFAULT 0,  -- 升級獲得的里程幣
  title_zh VARCHAR(50),            -- 等級稱號（中文）
  title_en VARCHAR(50)             -- 等級稱號（英文）
);

-- 初始數據範例
INSERT INTO level_config (level, xp_required, coins_reward, title_zh, title_en) VALUES
  (1,    0,    0,    '新手騎士',   'Rookie Rider'),
  (2,    300,  100,  '街坊騎手',   'Neighborhood Cyclist'),
  (3,    700,  200,  '區域探索者', 'Area Explorer'),
  (5,    1500, 500,  '城市騎士',   'City Rider'),
  (10,   4000, 1000, '都市傳奇',   'Urban Legend')
ON CONFLICT DO NOTHING;
```

### 成就系統（進階功能，可後期加入）

```sql
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,    -- 如 'first_ride', 'complete_900'
  name_zh VARCHAR(100),
  name_en VARCHAR(100),
  description_zh TEXT,
  description_en TEXT,
  icon VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_code VARCHAR(50) REFERENCES achievements(code),
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_code)
);
```

---

## 8. 路線導航實現方案

### GPX 解析（PWA）

CTRC 已有完整的 GPX 文件集（`/gpx/*.gpx`）。PWA 使用 Leaflet.js 解析並顯示：

```javascript
// PWA 範例（使用 Leaflet.js + leaflet-gpx）
import L from 'leaflet';
import 'leaflet-gpx';

async function loadGpxRoute(routeId, direction) {
  const gpxUrl = `/gpx/${routeId}${direction}.gpx`;
  
  new L.GPX(gpxUrl, {
    async: true,
    marker_options: {
      startIconUrl: '/images/pin-icon-start.png',
      endIconUrl: '/images/pin-icon-end.png',
    }
  }).addTo(map);
}
```

### 站點標記（在地圖上顯示站點）

```javascript
// 在地圖上標示各站點
function renderStops(stops, map) {
  stops.forEach(stop => {
    const marker = L.marker([stop.lat, stop.lon], {
      icon: L.divIcon({
        className: 'stop-marker',
        html: `<span>${stop.order}</span>`,
      })
    });
    marker.bindPopup(`<b>站 ${stop.order}</b><br>${stop.name}`);
    marker.addTo(map);
  });
}
```

### 實時 GPS 定位（Web Geolocation API）

```javascript
// PWA GPS 追蹤（支援 iOS 和 Android）
let watchId;

function startTracking(stops) {
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, speed } = position.coords;
      updateUserMarker(latitude, longitude);
      checkNearestStop(latitude, longitude, stops);
      recordTrackPoint({ latitude, longitude, speed, timestamp: Date.now() });
    },
    (error) => console.error('GPS Error:', error),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}

// 偵測接近站點並發出通知
// 注意：notified 狀態應存入 localStorage 以避免頁重載時重複通知
function checkNearestStop(lat, lon, stops) {
  const notifiedKey = 'notified_stops';
  const notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
  
  stops.forEach(stop => {
    const distance = getDistanceMeters(lat, lon, stop.lat, stop.lon);
    if (distance < 50 && !notified.includes(stop.order)) {
      notified.push(stop.order);
      localStorage.setItem(notifiedKey, JSON.stringify(notified));
      sendStopNotification(stop);
    }
  });
}

function stopTracking() {
  navigator.geolocation.clearWatch(watchId);
}
```

### 推送通知（報站）

```javascript
// PWA 推送通知（iOS 16.4+ 和 Android 均支援）
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

function sendStopNotification(stop) {
  if (Notification.permission === 'granted') {
    new Notification('🚏 即將到達', {
      body: `站 ${stop.order}：${stop.name}`,
      icon: '/images/icon-192.png',
      badge: '/images/badge-72.png',
    });
  }
}
```

### 地圖推薦選項（PWA）

| 地圖庫 | 費用 | 優點 |
|--------|------|------|
| **Leaflet.js + OpenStreetMap** | 完全免費 | 輕量、與現有網站技術一致、開源地圖 |
| **Leaflet.js + Google Maps** | 免費（每月前 $200 美元用量） | 中文地名完整，衛星圖清晰 |
| **MapLibre GL JS** | 完全免費開源 | 高效能、可定制風格 |

> 💡 **建議**：初期使用 Leaflet.js + OpenStreetMap（完全免費），
> 有需要時再切換至 Google Maps 底圖（保留中文地名）。

---

## 9. 儀表板同步方案

### 數據流向

```
PWA 騎行結束
    ↓
PWA 整理騎行數據（距離、時間、速度、途經站點）
    ↓
POST /api/rides  （帶 JWT token）
    ↓
後端計算 XP，更新 user_game_profile
    ↓
後端寫入 cycling_history 資料表
    ↓
回傳升級信息（新等級、新解鎖路線、獲得貨幣）
    ↓
PWA 顯示騎行總結頁（XP 動畫、升級動畫）
    ↓
用戶打開網站 /dashboard
    ↓
GET /api/getHistory  → 讀取 cycling_history
    ↓
儀表板顯示最新騎行紀錄 ✅
```

### 網站儀表板升級

目前 `/dashboard.html` 的騎行歷史顯示較為簡單（只有日期和距離）。  
加入遊戲化後，儀表板可展示更豐富的信息：

```
目前顯示：
  日期: 2026-03-09, 距離: 5.5 km

升級後可顯示：
  ┌─────────────────────────────────────┐
  │ 🎮 等級 3 — 區域探索者              │
  │ XP: 450 / 700  ████████░░ 64%      │
  │ 💰 里程幣: 350                      │
  └─────────────────────────────────────┘

  📍 900 市區海濱線  |  2026-03-09
  ⏱ 42 分鐘  |  🚴 5.5 km  |  💨 平均 7.9 km/h
  🚏 途經 5 個站點  |  +150 XP
  來源：CTRC PWA
```

---

## 10. 開發路線圖

### 第一階段：PWA 基礎版（約 3-5 週）

```
目標：在不需要上架 App Store 的情況下，讓用戶能在手機上查看路線地圖和站點。

工作項目：
  □ 為 /route_detail.html 加上 GPX 地圖顯示（使用 Leaflet.js）
  □ 加上站點標記（地圖上顯示各站點編號和名稱）
  □ 加上 Service Worker（讓頁面可離線訪問）
  □ 加上 Web App Manifest（讓用戶「加至主屏幕」）
  □ 加上 GPS 追蹤（Geolocation API，顯示用戶位置）
  □ 申請並顯示推送通知權限（iOS 16.4+/Android）
  □ 接近站點時發出通知提示

局限：
  - iOS 無後台 GPS 支援（螢幕熄滅後停止追蹤）
  - 地圖不能完全離線（需緩存瓦片）
```

### 第二階段：遊戲化系統（約 4-6 週）

```
目標：加入 XP、等級、路線解鎖和里程幣系統，令 App 具備遊戲性。

工作項目：
  □ 設計初始路線解鎖條件（哪些路線默認開放，哪些需解鎖）
  □ 後端：新增 user_game_profile、user_unlocked_routes、routes_config 資料表
  □ 後端：POST /api/rides 加入 XP 計算和等級更新邏輯
  □ 後端：GET /api/game-profile API
  □ 後端：POST /api/purchase-route API
  □ 前端：路線列表顯示解鎖狀態（已解鎖 / 需要等級 X / 需要 N 里程幣）
  □ 前端：騎行結束頁顯示 XP 獎勵、升級動畫
  □ 前端：儀表板顯示等級、XP 進度條、里程幣餘額
  □ 前端：路線商城（用里程幣購買特別路線）
```

### 第三階段：進階功能（視資源而定）

```
  □ 語音報站（Web Speech API）
  □ 離線地圖（Service Worker + 瓦片緩存）
  □ 成就系統和徽章
  □ 每日任務和排行榜
  □ React Native 原生 App（後台 GPS、完整 App Store 上架）
```

---

## 11. 開放問題與待決定事項

以下問題需要在正式開發前確認：

### 技術問題

- [ ] **地圖服務選擇**：Leaflet + OpenStreetMap（免費）還是 Google Maps（需帳單設置）？
- [ ] **Vercel Function 限額**：Hobby Plan 上限 12 個，新增 `/api/rides`、`/api/game-profile`、`/api/purchase-route` 後是否超限？建議使用下劃線前綴（如 `_rides.js`）規避計數。
- [ ] **GPS 軌跡存儲**：用戶實際騎行的 GPS 軌跡是否需要存儲？存儲在資料庫（JSONB 欄位）還是對象存儲（如 Vercel Blob）？
- [ ] **PWA 安裝提示**：如何引導 iOS 用戶手動「加至主屏幕」（iOS 不支援自動安裝提示）？

### 遊戲設計問題

- [ ] **初始開放路線**：建議默認開放 1-2 條最短、最易的路線（如 900 市區海濱線），其餘需解鎖。
- [ ] **XP 計算公式**：如何設計讓短路線和長路線的 XP 獎勵相對公平？（例如：基礎 XP + 每公里 XP）
- [ ] **里程幣匯率**：每次升級獲得多少里程幣？特別路線定價如何設定？
- [ ] **防刷機制**：同一路線一天內多次騎行是否給予相同 XP？（建議首次全額，後續減半）
- [ ] **特別路線定義**：哪些路線設為只能購買的「特別路線」？是否有限時路線？

### 站點設計問題

- [ ] **站點坐標來源**：各路線站點的 GPS 坐標需要實地採集或從現有 GPX 提取。
- [ ] **報站距離閾值**：接近多少米時觸發報站通知？（建議 50 米，視路線密度調整）
- [ ] **站點命名**：沿用現實地名還是另設 CTRC 專屬站名？

### 近期可做的準備工作（不用立即開發）

- [ ] 確定每條路線的站點列表及坐標
- [ ] 將 `js/main.js` 中的路線數據抽取為 `/api/routes.js`，加入站點和解鎖條件
- [ ] 擴展 `cycling_history` 表，加入 `duration_minutes`、`avg_speed_kmh`、`stops_reached`、`xp_earned` 等欄位
- [ ] 在 `/dashboard.html` 先準備好等級和 XP 展示區塊
- [ ] 研究 Leaflet.js 在現有網站 route_detail 頁面上展示 GPX 地圖（PWA 前置步驟）

---

## 12. 單車徑導航可行性探討

> 本節探討在現有 PWA App 基礎上，增加**香港單車徑實用導航**功能的可行性。
> 目的是讓 App 不僅具備遊戲化玩法，同時具備真正實用的「出行導航」價值。

---

### 12.1 背景：現有遊戲化功能 vs. 實用導航需求

#### 現有遊戲化模式（站點打卡）

目前 `ride.html` 的核心玩法是**站點式打卡**：

```
預先定義的「站點」（類似巴士站）
   ↓
GPS 偵測到接近站點 50 米內
   ↓
自動打卡 → 累積 XP → 升級解鎖路線
```

這套系統遊戲性強，但「指路能力」有限：App 不會主動告訴用戶「現在往哪個方向走」，只會在打卡成功後給予反饋。

#### 用戶實際需求（單車徑導航）

用戶騎自行車，往往需要：

1. **出發前**：選擇起點到終點的路徑，App 顯示全程路線
2. **騎行中**：沿途實時提示（「前方路口右轉」、「距離下一個路口 200 米」）
3. **岔路口**：清晰的轉向指示，不走錯路
4. **香港單車徑網絡**：沿翠徑、新界東部、西部等專用單車徑的導航

#### 兩者可以並存

遊戲化打卡（現有）與實用導航（新增）並不矛盾，可以設計為**兩種騎行模式**：

| 模式 | 說明 | 核心體驗 |
|------|------|---------|
| 🎮 **遊戲模式**（現有） | 選定路線，沿途打卡站點，獲得 XP | 像遊戲，目標是升級解鎖 |
| 🗺️ **導航模式**（新增） | 選擇起訖點，App 規劃單車徑路線，全程引路 | 像 Google Maps，目標是到達目的地 |

---

### 12.2 香港單車徑概覽

香港擁有完善的**新界單車徑網絡**，主要集中於：

#### 新界東部（約 60 km）

```
粉嶺 ──────── 大埔 ──────── 沙田 ──────── 馬鞍山
 (單車公路)   (吐露港單車徑)  (沙田單車徑)  (馬鞍山單車徑)
              大尾篤 ← 分支
```

| 路段 | 長度（約） | 特色 |
|------|----------|------|
| 沙田至大埔（吐露港沿岸） | ~12 km | 海景，適合家庭 |
| 大埔至粉嶺 | ~10 km | 平坦，全程專用路 |
| 馬鞍山單車徑（烏溪沙至沙田） | ~8 km | 海濱風景 |

#### 新界西部（約 35 km）

```
屯門 ──────── 天水圍 ──────── 元朗
 (屯門河畔)   (天水圍單車徑)   (元朗單車徑)
```

| 路段 | 長度（約） | 特色 |
|------|----------|------|
| 元朗至天水圍 | ~8 km | 平坦，鬧市邊 |
| 屯門河畔 | ~10 km | 連接輕鐵站點 |

#### 與現有路線的關係

目前 CTRC HK 的路線（900、914、966 等）以**將軍澳區**為主，屬於城市單車路線。
上述新界單車徑屬於**不同地域**，可作為日後擴充地區的重點目標。

---

### 12.3 技術可行性分析

#### 12.3.1 地圖資料來源

| 資料來源 | 單車徑覆蓋 | 費用 | 適用性 |
|---------|-----------|------|-------|
| **OpenStreetMap（OSM）** | ✅ 香港單車徑全面標注（highway=cycleway） | 完全免費 | ⭐⭐⭐⭐⭐ 強烈推薦 |
| **政府地理資訊地圖（GeoData）** | ✅ 官方數據，含單車徑圖層 | 免費（政府開放數據） | ⭐⭐⭐⭐ 推薦（但需解析格式） |
| **Google Maps Directions API（自行車）** | ⚠️ 香港單車徑支援有限 | 按用量收費 | ⭐⭐ 不推薦（費用＋覆蓋不全） |
| **HERE Maps Cycling** | ⚠️ 有香港數據，但不完整 | 免費配額後收費 | ⭐⭐⭐ 備用 |

**結論：優先使用 OpenStreetMap 數據（完全免費且社群維護最完整）。**

#### 12.3.2 路由引擎選項

要把「起點 → 終點」規劃成沿單車徑的路徑，需要**路由引擎（Routing Engine）**：

| 路由引擎 | 自架成本 | 單車模式 | 建議用法 |
|---------|---------|---------|---------|
| **OSRM（Open Source Routing Machine）** | 需自架伺服器 | ✅ 有單車 profile | 中高成本，性能最佳 |
| **Valhalla** | 需自架伺服器 | ✅ 有 bicycle mode | 功能豐富，支援轉向指示 |
| **GraphHopper（免費 API）** | 無需自架 | ✅ 有 bike profile | 每日 500 次免費，適合 MVP |
| **Brouter（純前端）** | 無需伺服器 | ✅ 專門做單車路由 | 可完全在瀏覽器運行，離線可用 |
| **OSM Routing（Nominatim + OSRM demo）** | 無需自架 | ✅ 有 | 只適合開發測試，生產環境不推薦 |

**MVP 建議：先用 GraphHopper 免費 API 驗證可行性，再考慮自架 Brouter 做離線路由。**

#### 12.3.3 現有技術棧兼容性

```
現有 PWA 技術棧             是否兼容單車徑導航？
─────────────────────────────────────────────
Leaflet.js 地圖              ✅ 完全兼容：可顯示路線、轉向標記、用戶位置
GPS watchPosition()          ✅ 完全兼容：沿途更新位置
GPX 文件解析                 ✅ 可用：如果路線已有 GPX，直接顯示
Vercel Serverless API         ✅ 可新增路由代理 API（隱藏第三方 API Key）
Service Worker 緩存           ✅ 可緩存預先計算的路線數據
PWA 推送通知                  ✅ 可用於轉向提示
```

**結論：現有技術棧完全支援增加單車徑導航，無需引入新框架。**

---

### 12.4 實現方案比較

#### 方案 A：純 GPX 追蹤（最小改動）⭐ 推薦首先實施

**原理**：手動規劃單車徑路線並匯出為 GPX 文件，App 顯示 GPX 路線 + 用戶位置。

```
優點：
  ✅ 改動最小，與現有 ride.html 架構完全一致
  ✅ 無需第三方路由 API，完全免費
  ✅ 可精確標注香港官方單車徑（避免 OSM 誤差）
  ✅ 沿用現有 GPX 文件基礎設施

缺點：
  ❌ 無動態路徑規劃（路線預先固定，不能任意起訖點）
  ❌ 轉向提示需手動在 GPX 的 waypoints 中預設
  ❌ 路線需人工預先錄製
```

**實施步驟**：
1. 實地騎行（或使用 Strava / Komoot 等工具）錄製主要單車徑 GPX
2. 在現有 `routes.json` 加入「單車徑路線」分類
3. 為這類路線加入「導航模式」標記（`"nav_mode": true`）
4. `ride.html` 新增「導航模式」UI：顯示下一個路口距離 + 方向箭頭

#### 方案 B：GraphHopper API 動態路由（MVP 中期目標）

**原理**：用戶輸入起訖點，App 調用路由 API，即時規劃沿單車徑的路線。

```
架構：
  用戶輸入起訖點
      ↓
  POST /api/route-plan （Vercel 代理，隱藏 API Key）
      ↓
  GraphHopper Routing API（bike profile）
      ↓
  返回 GeoJSON 路線 + 轉向指示（turn-by-turn）
      ↓
  Leaflet 顯示路線，ride.html 沿途導航
```

```javascript
// 新增 Vercel API 代理（api/route-plan.js）
export default async function handler(req, res) {
  const { from_lat, from_lon, to_lat, to_lon } = req.query;

  // 輸入驗證：確保坐標為有效數字並在合理地理範圍內
  const coords = [from_lat, from_lon, to_lat, to_lon].map(Number);
  if (coords.some(isNaN)) {
    return res.status(400).json({ error: '無效的坐標格式' });
  }
  const [fLat, fLon, tLat, tLon] = coords;
  if (fLat < -90 || fLat > 90 || tLat < -90 || tLat > 90 ||
      fLon < -180 || fLon > 180 || tLon < -180 || tLon > 180) {
    return res.status(400).json({ error: '坐標超出有效範圍' });
  }

  const apiKey = process.env.GRAPHHOPPER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '路由服務未配置' });
  }

  const url = `https://graphhopper.com/api/1/route` +
    `?point=${fLat},${fLon}` +
    `&point=${tLat},${tLon}` +
    `&vehicle=bike` +
    `&locale=zh-TW` +
    `&instructions=true` +
    `&calc_points=true` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: '路由服務錯誤', detail: errText });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '無法連接路由服務，請稍後再試' });
  }
}
```

```
優點：
  ✅ 支援任意起訖點，用戶靈活性最高
  ✅ 自動規劃沿單車徑的路線
  ✅ 提供逐步轉向指示（turn-by-turn）
  ✅ GraphHopper 每日 500 次免費（足夠 MVP 測試）

缺點：
  ❌ 需要額外 API Key 管理
  ❌ 香港單車徑數據依賴 OSM 品質（需驗證）
  ❌ 超過免費配額後需付費或自架
```

#### 方案 C：Brouter 純前端離線路由（長期目標）

**原理**：Brouter 是專為單車設計的路由引擎，可完全在瀏覽器內運行（WebAssembly），無需伺服器。

```
優點：
  ✅ 完全離線（路線數據預先下載到 Service Worker 緩存）
  ✅ 專為單車優化（偏好單車徑、避免主幹道）
  ✅ 無 API 費用
  ✅ 香港地區 OSM 數據包體積約 30-50 MB（可接受）

缺點：
  ❌ 首次下載地圖數據較大
  ❌ 整合較複雜，需要 WebAssembly 支援
  ❌ 適合長期版本，不適合 MVP
```

---

### 12.5 單車徑導航 UI 設計

#### 新增「導航模式」入口

在現有騎行頁面（`routes.html` 的 `#app-ride-page`）新增入口：

```
┌─────────────────────────────────────────┐
│  [🎮 遊戲模式]   [🗺️ 導航模式]         │  ← 頂部 Tab 切換
└─────────────────────────────────────────┘

導航模式：
┌─────────────────────────────────────────┐
│  📍 從 ___________                      │
│  🏁 到 ___________    [規劃路線]        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │         Leaflet 地圖            │   │
│  │   （顯示規劃路線 + 用戶位置）   │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  路線：沙田 → 大埔（12.3 km）           │
│  預計時間：55 分鐘                      │
│                                         │
│      [開始導航]                         │
└─────────────────────────────────────────┘
```

#### 騎行中導航 UI（ride.html 新增「導航模式」）

```
┌─────────────────────────────────────────┐
│  ↱ 前方 200 米  右轉  進入單車徑       │  ← 轉向提示條
├─────────────────────────────────────────┤
│                                         │
│         Leaflet 地圖                    │
│      （用戶位置、路線高亮）             │
│                                         │
├─────────────────────────────────────────┤
│  📍 已行：3.2 km   ⏱ 14 分鐘          │
│  🏁 剩餘：9.1 km   預計還需 40 分鐘   │
└─────────────────────────────────────────┘
```

---

### 12.6 與現有遊戲化系統整合

導航模式與遊戲化模式應能**共存**，建議整合方式：

| 整合點 | 做法 |
|--------|------|
| **XP 獎勵** | 完成導航路線也可獲得 XP（按距離計算，如每 km = 20 XP） |
| **路線解鎖** | 部分長途單車徑路線作為高等級解鎖獎勵（如沙田至大埔全程解鎖在 Lv.25） |
| **成就系統** | 完成特定單車徑路線觸發成就（如「吐露港騎士」、「全港單車徑挑戰者」） |
| **歷史記錄** | 導航模式的騎行紀錄同樣記錄在 `cycling_history`，於儀表板顯示 |
| **騎行模式標記** | `source` 欄位新增 `'nav'` 值，區分遊戲模式與導航模式 |

---

### 12.7 資料庫擴充（導航模式）

需在現有資料庫結構上增加以下內容：

```sql
-- 在 cycling_history 新增 nav_mode 標記
ALTER TABLE cycling_history
  ADD COLUMN IF NOT EXISTS nav_mode BOOLEAN DEFAULT FALSE,
  -- nav_mode=TRUE 表示導航模式騎行；FALSE（預設）為遊戲模式
  ADD COLUMN IF NOT EXISTS nav_from TEXT,   -- 導航起點描述
  ADD COLUMN IF NOT EXISTS nav_to TEXT;     -- 導航終點描述

-- 在 routes_config 新增「單車徑路線」分類（方案A用）
ALTER TABLE routes_config
  ADD COLUMN IF NOT EXISTS route_type VARCHAR(20) DEFAULT 'bus_route';
  -- route_type: 'bus_route'（現有城市路線）| 'cycle_track'（單車徑路線）
```

---

### 12.8 技術挑戰與風險

| 挑戰 | 影響 | 應對方案 |
|------|------|---------|
| **GPS 精確度**：單車徑有時緊鄰馬路，GPS 可能偏移到路面上 | 中 | 設置「吸附路線」(route snapping) 邏輯，偏移超 30 米時自動重新計算 |
| **OSM 數據品質**：部分偏遠單車徑可能未在 OSM 標注 | 中 | 人工補充重要單車徑的 GPX（方案A兜底） |
| **iOS 後台 GPS 限制**：螢幕熄滅後 GPS 停止更新 | 高 | 明確告知用戶保持螢幕開啟；導航中顯示提醒橫幅 |
| **網絡斷線**：單車徑部分區域（如新界郊野）信號弱 | 中 | Service Worker 緩存已下載的路線數據；地圖瓦片預先緩存 |
| **Vercel Function 數量限制**：Hobby Plan 上限 12 個 | 低 | 新 API 使用下劃線前綴（`api/_route-plan.js`）規避計數 |
| **API 費用**：路由 API 超出免費配額 | 低（初期） | GraphHopper 免費 500 次/日已足夠；長期遷移至 Brouter（免費） |

---

### 12.9 建議實施步驟

#### 第一步（最快落地，約 1-2 週）

- [ ] 手動錄製 2-3 條主要單車徑的 GPX 文件（如：沙田至大埔海濱單車徑）
- [ ] 在 `routes.json` 加入這些單車徑路線，標記 `"route_type": "cycle_track"`
- [ ] `routes.html` 新增「單車徑」篩選 chip
- [ ] `ride.html` 為 `cycle_track` 類型顯示「沿途方向」提示（從 GPX waypoints 讀取）

#### 第二步（中期，約 2-4 週）

- [ ] 新增 Vercel API `api/_route-plan.js`，代理 GraphHopper API
- [ ] `routes.html` 增加「導航模式」Tab，含起訖點輸入
- [ ] `ride.html` 新增逐步轉向指示（turn-by-turn）UI
- [ ] Service Worker 緩存路線數據，支援弱網絡環境

#### 第三步（長期，視資源決定）

- [ ] 整合 Brouter WebAssembly，實現完全離線路由
- [ ] 加入「吸附路線」邏輯（GPS 偏移自動修正）
- [ ] 語音導航（Web Speech API 播報轉向指示）
- [ ] 擴充至更多地區：馬鞍山、元朗、屯門等單車徑

---

### 12.10 結論

| 評估項目 | 結論 |
|---------|------|
| **技術可行性** | ✅ 高度可行，現有技術棧（Leaflet、GPS、PWA）完全支援 |
| **成本** | ✅ MVP 階段可以零成本實現（OpenStreetMap + GraphHopper 免費配額） |
| **與現有功能兼容** | ✅ 遊戲化模式與導航模式可並存，互不影響 |
| **用戶實用性** | ✅ 大幅提升 App 的日常實用性，吸引非遊戲化用戶 |
| **建議優先度** | 🟡 中高優先，建議在現有遊戲化功能穩定後的下一階段推進 |

**最佳起步方式**：先以「方案 A（純 GPX 追蹤）」形式，為 1-2 條香港知名單車徑（如沙田吐露港海濱單車徑）製作 GPX 文件並加入路線庫，讓用戶可在遊戲模式下騎行該路線並獲得 XP。同時，在 `ride.html` 加入方向箭頭顯示（根據 GPX 軌跡自動計算），提升「實用導航感」，為第二步動態路由功能的引入做好 UI 準備。

---

### 12.11 目標升級：超越傳統導航的車道級單車徑導航

#### 核心願景

> 目標是開發一款以**單車徑為主體**的動態車道級導航，在用戶體驗上全面超越 Google Maps、Apple Maps 等傳統導航。

| 對比項目 | 傳統導航（Google/Apple Maps） | CTRC HK 單車徑導航 |
|---------|------------------------------|------------------|
| **路徑規劃** | 以公路/馬路為主，單車路徑次要 | ✅ **以單車徑為優先**，盡量走專用徑 |
| **地圖顯示** | 公路佔主導，單車徑不突出 | ✅ **單車徑高亮顯示**，清晰可見 |
| **車道層級** | 無法顯示單車徑劃線細節 | ✅ **清晰顯示路面劃線、方向箭頭** |
| **動態路線** | 靜態地圖，不針對單車徑即時更新 | ✅ **即時更新**，根據 GPS 位置動態調整 |
| **本地化** | 通用導航，不了解香港單車徑細節 | ✅ **專為香港單車徑設計** |
| **費用** | 免費（但 API 有限制） | ✅ **完全零成本** |

#### 「車道級導航」的具體含義

「車道級（Lane-Level）」對於單車導航，意味著地圖在高縮放時能顯示如同實際路面的細節：

```
一般導航顯示（低精度）：
  ───────────────────────────────────────  ← 一條模糊線段

車道級單車導航顯示（高精度）：
  ══════════════════════════════════════  ← 單車徑（顯示實際路幅寬度）
     ←  ←  ←  ←  ←  ←  ←  ←  ←  ←     ← 方向箭頭劃線（模擬路面標記）
  🚲─────🚲──────────────────────────    ← 用戶位置及前方路況
     ▲ ⚠️ 前方路口 50m                   ← 路口提示
```

具體視覺元素：

1. **彩色路徑高亮**：單車徑以鮮明顏色（如綠色）與普通道路區分
2. **劃線標記**：模擬實際路面的虛線中線、方向箭頭標記
3. **路口指示**：岔路口顯示清晰箭頭，提示用戶下一步方向
4. **用戶位置貼附**：GPS 位置自動「吸附」至單車徑中心線
5. **動態縮放**：接近路口時自動放大地圖，顯示更多車道細節

---

### 12.12 將軍澳單車徑網絡詳覽（首階段目標）

> 第一階段專注於**將軍澳區**，因為這正是 CTRC HK 現有路線（900、900A、966T 等）的覆蓋範圍，並且擁有完善的專用單車徑網絡。

#### 將軍澳主要單車徑路段

```
寶琳（新都城二期）
     │
     ▼ 坑口單車徑（沿坑口道）約 1.5 km
     │
坑口（港鐵站周邊）
     │
     ▼ 將軍澳市中心段（環保大道）約 2.5 km
     │
將軍澳市中心（日出康城方向）
     │
     ├──→ 調景嶺海濱（沿海單車徑）約 1.5 km
     │
調景嶺（彩明苑）
     │
     ▼ 調景嶺至坑口（LOHAS Park 方向）約 2 km
     │
日出康城（LOHAS Park）
```

#### 路段概覽

| 路段 | 長度（約） | 路面狀況 | OSM 數據完整度 |
|------|----------|---------|--------------|
| 寶琳 ↔ 坑口 | 1.5 km | 平坦，瀝青 | ⚠️ 部分標注 |
| 坑口 ↔ 將軍澳市中心 | 2.5 km | 平坦，瀝青 | ✅ 完整 |
| 將軍澳市中心 ↔ 調景嶺海濱 | 1.5 km | 平坦，海景 | ✅ 完整 |
| 調景嶺 ↔ 日出康城 | 2 km | 平坦，瀝青 | ✅ 完整 |
| 環保大道支線 | 1 km | 平坦，瀝青 | ✅ 完整 |
| **合計** | **~8.5 km** | — | ✅ 大部分完整 |

#### OSM 標注情況（將軍澳）

| 路段 | OSM 標籤 | 數據狀態 |
|------|---------|---------|
| 坑口單車徑 | `highway=cycleway` | ✅ 完整 |
| 將軍澳環保大道 | `highway=cycleway` | ✅ 完整 |
| 調景嶺海濱 | `highway=cycleway` + `surface=asphalt` | ✅ 完整 |
| 寶琳周邊 | `highway=path` + `bicycle=designated` | ⚠️ 部分 |
| 日出康城周邊 | `highway=cycleway` | ✅ 完整 |

**OSM 數據提取工具**：可使用 [Overpass Turbo](https://overpass-turbo.eu) 以下查詢提取將軍澳所有單車徑：

```
[out:json][timeout:25];
(
  way["highway"="cycleway"]({{bbox}});
  way["bicycle"="designated"]["highway"="path"]({{bbox}});
  way["bicycle"="designated"]["highway"="track"]({{bbox}});
);
out body;
>;
out skel qt;
```

#### 政府 GeoData 單車徑數據

香港政府在 [GeoData.gov.hk](https://geodata.gov.hk) 免費提供官方單車徑矢量數據：

| 數據集 | 格式 | 精確度 | 說明 |
|-------|------|-------|------|
| 香港單車徑網絡 | GeoJSON / Shapefile | ✅ 高（政府官方） | 含路段分類、寬度資訊 |
| 道路交通設施 | GeoJSON | ✅ 中 | 含單車停放設施 |

**與 OSM 結合使用**：GeoData 官方數據 + OSM 社群標注 = 最準確的將軍澳單車徑資料庫，兩者均完全免費。

---

### 12.13 零成本完整技術方案分析

#### 費用總計：$0

| 組件 | 選擇方案 | 費用 | 說明 |
|------|---------|------|------|
| **地圖底圖** | OpenFreeMap.org 向量圖磚 | **免費** | CDN 向量圖磚，無需 API Key，無流量限制 |
| **地圖渲染引擎** | MapLibre GL JS | **免費** | Mapbox GL JS 的開源分支，WebGL 加速 |
| **單車徑數據** | OpenStreetMap（Overpass API） | **免費** | 社群維護，將軍澳覆蓋完整 |
| **政府官方數據** | GeoData.gov.hk | **免費** | 香港政府開放數據 |
| **路由計算** | Brouter WASM（瀏覽器內運行） | **免費** | 無需伺服器，純前端 WASM |
| **地理編碼** | Nominatim（OSM 官方） | **免費**（有使用限制） | 搜尋地名轉坐標 |
| **部署** | Vercel Hobby 現有方案 | **免費** | 無需新增伺服器資源 |
| **合計** | — | **$0 / 月** | 完全無成本 |

#### 地圖底圖方案對比

| 方案 | 費用 | 向量支援 | 適合性 | 備注 |
|------|------|--------|-------|------|
| **OpenFreeMap.org** ⭐ | 完全免費 | ✅ | ⭐⭐⭐⭐⭐ | 無流量限制，推薦首選 |
| **Protomaps（自架 + Cloudflare）** | 免費 | ✅ | ⭐⭐⭐⭐ | 需額外配置 Cloudflare Worker |
| **CARTO Basemaps** | 免費（75k 請求/月） | ✅ | ⭐⭐⭐⭐ | 有月度配額上限 |
| **OpenStreetMap 標準圖磚** | 免費（有限制） | ❌（圖片格式） | ⭐⭐⭐ | 不支援向量，無法自定義樣式 |
| **Google Maps** | 按用量收費 | ✅ | ❌ | 有成本，單車徑覆蓋不全 |

**推薦方案：OpenFreeMap.org + MapLibre GL JS**
- OpenFreeMap 提供免費、無流量限制的 OpenMapTiles 格式向量圖磚
- MapLibre GL JS 完全開源，可完全自定義地圖樣式
- 兩者結合可實現接近 Mapbox 的視覺效果，但**零成本**

#### 路由引擎方案對比

| 方案 | 費用 | 離線支援 | 單車優化程度 | 適合階段 |
|------|------|--------|-----------|---------|
| **OSRM Demo API** | 完全免費 | ❌ 需網絡 | ⚠️ 一般 | ✅ 初期快速驗證 |
| **GraphHopper 免費配額** | 免費（500次/日） | ❌ 需網絡 | ✅ 有 bike profile | ✅ 中期 MVP |
| **Brouter WASM** ⭐ | 完全免費 | ✅ 完全離線 | ✅ 最佳（專為單車） | 中長期目標 |
| **Valhalla（自架）** | 免費（需伺服器） | ✅ 離線 | ✅ 好 | ❌ 成本高 |

**推薦方案（分階段）**：

1. **初期**：`OSRM Demo API`（`router.project-osrm.org`）—— 完全免費，無需 API Key，即時可用
2. **中期**：`GraphHopper 免費 API` —— 更好的單車路徑優化，每日 500 次足夠測試
3. **長期**：`Brouter WASM` —— 完全離線、專為單車設計、永遠免費

---

### 12.14 車道級視覺化實現技術

#### 從 Leaflet 升級至 MapLibre GL JS

現有 `ride.html` 使用 Leaflet.js 顯示地圖。為實現車道級顯示效果，建議升級至 **MapLibre GL JS**（支援向量瓦片及自定義樣式）：

| 功能 | Leaflet.js（現有） | MapLibre GL JS（升級目標） |
|------|------------------|--------------------------|
| 向量瓦片支援 | ❌ 只支援圖磚（圖片） | ✅ 原生支援向量瓦片 |
| 路型自定義樣式 | ⚠️ 有限（疊加層） | ✅ 完全自定義（按縮放、路型分類） |
| 單車徑高亮 | ⚠️ 需手動疊加層 | ✅ 原生樣式規則，按 OSM 標籤自動渲染 |
| 方向箭頭符號 | ⚠️ 需手動繪製 | ✅ symbol 圖層原生支援 |
| 性能 | 中 | ✅ 高（WebGL GPU 加速） |
| 檔案大小 | ~130 KB | ~250 KB |
| 費用 | 免費 | **免費**（開源） |

#### 車道級單車徑樣式方案

使用 MapLibre GL JS 的樣式規則，可以精確控制單車徑的顯示效果：

```javascript
// MapLibre GL JS 樣式配置示例（車道級單車徑顯示）
const cyclePathLayers = [
  // 底層：單車徑路幅（綠色寬條，模擬路面寬度）
  {
    id: 'cycleway-fill',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['any',
      ['==', ['get', 'subclass'], 'cycleway'],
      ['==', ['get', 'bicycle'], 'designated']
    ],
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'subclass'], 'cycleway'], '#00C853', // 綠色：專用單車徑
        ['==', ['get', 'bicycle'], 'designated'],  '#64DD17', // 淺綠：指定單車路
        '#AAAAAA' // 灰色：其他路徑
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'],
        12, 2,   // 縮放 12：2px（概覽）
        15, 5,   // 縮放 15：5px（區域）
        17, 10,  // 縮放 17：10px（路段，開始顯示車道細節）
        19, 18   // 縮放 19：18px（車道級別，顯示路面劃線）
      ],
      'line-opacity': 0.85
    }
  },
  // 中層：虛線中線（模擬路面中線劃線）
  {
    id: 'cycleway-centerline',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['==', ['get', 'subclass'], 'cycleway'],
    minzoom: 16,
    paint: {
      'line-color': '#FFFFFF',
      'line-width': 1,
      'line-dasharray': [4, 4],  // 虛線：模擬路面白色中線
      'line-opacity': 0.7
    }
  },
  // 上層：方向箭頭（縮放 15+ 時顯示，指示單車行駛方向）
  {
    id: 'cycleway-arrows',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['==', ['get', 'subclass'], 'cycleway'],
    minzoom: 15,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 120,
      'icon-image': 'cycle-arrow',   // 自定義單車箭頭圖標
      'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.5, 18, 1.0],
      'icon-rotation-alignment': 'map'
    }
  }
];
```

#### 政府 GeoData 數據疊加

政府官方單車徑數據可作為額外圖層疊加，補充 OSM 可能缺漏的路段：

```javascript
map.on('load', () => {
  // 方法一：直接引用政府 WMS/GeoJSON API（需網絡連接）
  // 方法二（推薦）：預先下載 GeoJSON 靜態文件，放入 /gpx/tko/ 資料夾
  map.addSource('tko-official-cycling', {
    type: 'geojson',
    data: '/gpx/tko/cycling_tracks_tko.geojson'  // 本地靜態文件，零 API 成本
  });

  map.addLayer({
    id: 'hk-official-cycleways',
    type: 'line',
    source: 'tko-official-cycling',
    paint: {
      'line-color': '#00E676',       // 亮綠色：政府官方數據
      'line-width': 4,
      'line-dasharray': [1, 0],      // 實線：官方已確認路段
      'line-opacity': 0.9
    }
  });
});
```

#### GPS 路線貼附（Route Snapping）

防止 GPS 漂移導致用戶位置偏離單車徑顯示：

```javascript
/**
 * 路線貼附算法：將用戶 GPS 位置吸附至最近的單車徑中線
 *
 * @param {number} userLat       - 用戶當前緯度
 * @param {number} userLon       - 用戶當前經度
 * @param {Array}  routeCoords   - 路線座標陣列，格式：[[lon, lat], [lon, lat], ...]
 * @returns {Array}              - 吸附後的座標 [lon, lat]；若偏離 > 30m 則返回原始位置
 */
function snapToRoute(userLat, userLon, routeCoords) {
  let minDist = Infinity;
  let snappedPoint = null;

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const point = closestPointOnSegment(
      [userLon, userLat],
      routeCoords[i],
      routeCoords[i + 1]
    );
    const dist = haversineDistance(userLat, userLon, point[1], point[0]);
    if (dist < minDist) {
      minDist = dist;
      snappedPoint = point;
    }
  }

  // 偏離超過 30 米時返回真實位置（可能已離開單車徑，不強制吸附）
  return minDist < 30 ? snappedPoint : [userLon, userLat];
}
```

#### 地圖自動旋轉（Heading Up）

騎行時地圖方向跟隨騎行方向旋轉，始終保持「前方在上」：

```javascript
// 根據 GPS 軌跡自動計算行進方向並旋轉地圖
let lastPosition = null;

navigator.geolocation.watchPosition((pos) => {
  const { latitude, longitude } = pos.coords;

  if (lastPosition) {
    const bearing = calculateBearing(
      lastPosition.lat, lastPosition.lon,
      latitude, longitude
    );
    map.easeTo({ bearing, duration: 500 });  // 流暢旋轉地圖
  }

  lastPosition = { lat: latitude, lon: longitude };
  map.setCenter([longitude, latitude]);
});
```

---

### 12.15 首階段實施計劃（將軍澳）

#### 目標範圍

```
首階段覆蓋：將軍澳區全部主要單車徑
  └─ 寶琳 ↔ 坑口段（~1.5 km）
  └─ 坑口 ↔ 將軍澳市中心段（~2.5 km）
  └─ 將軍澳市中心 ↔ 調景嶺海濱段（~1.5 km）
  └─ 調景嶺 ↔ 日出康城段（~2 km）
  └─ 環保大道支線（~1 km）

  總計：約 8.5 km 單車徑網絡
  覆蓋現有路線：900、900A、966T（全部在範圍內）
```

#### 實施步驟（漸進式，全程零成本）

##### 第一步：數據準備（約 1 週）

- [ ] 從 [GeoData.gov.hk](https://geodata.gov.hk) 下載將軍澳單車徑 GeoJSON 數據
- [ ] 用 [Overpass Turbo](https://overpass-turbo.eu) 匯出將軍澳 OSM 單車徑數據（GeoJSON）
- [ ] 比對兩份數據，補充缺漏路段，整合為 `cycling_tracks_tko.geojson`
- [ ] 將文件放入 `/gpx/tko/` 資料夾（靜態文件，零 API 成本）

##### 第二步：地圖引擎升級（約 1-2 週）

- [ ] 在 `ride.html` 引入 MapLibre GL JS（可與現有 Leaflet 並存，按模式切換）
  ```html
  <!-- ride.html 新增（導航模式使用） -->
  <link href='https://unpkg.com/maplibre-gl/dist/maplibre-gl.css' rel='stylesheet' />
  <script src='https://unpkg.com/maplibre-gl/dist/maplibre-gl.js'></script>
  ```
- [ ] 配置 OpenFreeMap.org 作為免費向量底圖來源
- [ ] 套用車道級單車徑樣式（綠色高亮 + 方向箭頭 + 虛線中線）
- [ ] 疊加政府 GeoJSON 數據圖層（本地靜態文件，無 API 費用）

##### 第三步：導航核心功能（約 2-3 週）

- [ ] 接入 OSRM Demo API（免費）作為初期路由引擎，驗證導航邏輯
- [ ] 實現將軍澳範圍內「起點到終點」沿單車徑路線規劃 UI
- [ ] 動態轉向指示（turn-by-turn）顯示，顯示下一個路口距離及方向
- [ ] GPS 路線貼附邏輯（防止位置漂移偏離單車徑）
- [ ] 路口接近時自動放大地圖（縮放至 zoom level 17–18 顯示車道細節）
- [ ] 地圖自動旋轉（Heading Up，前進方向始終向上）

##### 第四步：體驗提升（持續優化）

- [ ] 語音轉向提示（Web Speech API，完全免費）
- [ ] Service Worker 預快取將軍澳地圖瓦片（離線支援，弱網環境可用）
- [ ] 接入 Brouter WASM，替換 OSRM（更精準的單車路徑規劃）
- [ ] 新增「路況標記」功能（用戶可標記路段狀況，社群回報）

#### 技術依存關係

```
OpenFreeMap.org 向量圖磚（免費 CDN）
        │
        ▼
MapLibre GL JS（開源 WebGL 地圖渲染）
        │
        ├── /gpx/tko/cycling_tracks_tko.geojson（政府+OSM整合數據）
        ├── OSM 向量圖磚樣式（車道級單車徑高亮）
        └── OSRM / Brouter（路由計算，均免費）
                │
                ▼
        ride.html 導航模式（新增 Tab）
                │
                ├── GPS watchPosition()（現有，複用）
                ├── 路線貼附邏輯（新增）
                ├── 地圖自動旋轉（新增）
                └── 轉向提示 UI（新增）
```

#### 與現有遊戲化系統並存

首階段導航功能設計為**不影響現有遊戲化功能**，可直接整合：

| 整合點 | 實施方式 |
|--------|---------|
| 不影響現有打卡功能 | 導航模式作為 `ride.html` 的新 Tab，現有遊戲模式完整保留 |
| 路線 900/900A 同步 | 現有路線的 GPX 可作為導航路線的基礎路徑，一次製作雙用 |
| 騎行記錄 | 導航騎行同樣記入 `cycling_history`，`source='nav'` 標記 |
| 零後端修改 | 初期全部邏輯在前端實現，不需要新增任何後端 API |
| XP 整合 | 完成導航路線亦可獲 XP（按距離計算），遊戲化與實用並存 |

---

### 12.16 更新結論（包含車道級導航目標）

| 評估項目 | 結論 |
|---------|------|
| **技術可行性** | ✅ 高度可行：MapLibre GL JS + OSM + GeoData 可實現車道級顯示 |
| **成本** | ✅ **完全零成本**：OpenFreeMap + Brouter + OSM + GeoData.gov.hk 均免費 |
| **首階段範圍** | ✅ **將軍澳區**：現有路線覆蓋範圍，OSM 數據完整，最適合優先實施 |
| **與現有功能兼容** | ✅ 導航模式與遊戲化模式並存，共用同一 `ride.html`，互不影響 |
| **超越傳統導航** | ✅ 單車徑優先、車道劃線顯示，是 Google Maps 無法提供的體驗 |
| **建議優先度** | 🟢 **高優先**：從將軍澳出發，MapLibre GL JS 重構地圖顯示，分步實現 |

**最終目標願景**：

一款完全免費、以香港單車徑為核心的動態車道級導航 App，用戶可以：

1. 選擇將軍澳任意起點與終點
2. App 自動規劃沿單車徑的最佳路線（優先走專用徑）
3. 全程高亮顯示單車徑，清晰可見路面劃線及方向箭頭
4. 轉彎前 200 米提示（視覺 + 語音）
5. 地圖隨騎行方向自動旋轉，始終前方在上
6. 無需網絡連接（本地數據緩存，離線可用）

> 💡 **與遊戲化功能結合**：導航路線同樣可獲得 XP 獎勵，打通「實用工具」與「遊戲體驗」，令用戶有多重理由持續使用 App。

---

## 13. 常見問題：導航頁面（/nav）

### 13.1 打開導航頁面立刻死機或卡頓怎麼辦？

**原因**：`nav.html` 使用 MapLibre GL JS（WebGL 向量地圖渲染），在以下情況下可能立即死機：

| 原因 | 說明 |
|------|------|
| **裝置不支援 WebGL** | 部分舊款 Android 或低端設備的瀏覽器不支援 WebGL，`new maplibregl.Map()` 直接崩潰 |
| **地圖錯誤事件循環** | `map.on('error', ...)` 對每一個失敗的地圖瓦片請求都觸發，若沒有防抖保護，每個 404 回應都會調用 `setStyle()`，在短時間內反複重設地圖 WebGL 狀態，導致瀏覽器崩潰或介面凍結 |
| **OpenFreeMap CDN 不可用** | `tiles.openfreemap.org` 暫時不可用時，大量請求同時失敗，上述循環問題更嚴重 |

**已修復（目前版本）**：

1. **WebGL 支援檢查**：在建立地圖前先調用 `maplibregl.supported()`，不支援時顯示友善提示而非崩潰
2. **Fallback 防抖保護**：`fallbackToRasterTiles()` 加入 `fallbackUsed` 標誌，確保只執行一次，徹底杜絕錯誤事件循環
3. **載入逾時保護**：12 秒後自動移除載入遮罩，即使地圖初始化失敗，用戶也不會被白屏困住

如果你仍遇到地圖無法顯示的問題：
- 確認設備支援 WebGL（可在 [https://get.webgl.org](https://get.webgl.org) 測試）
- 嘗試關閉省電模式（省電模式常會停用 GPU 加速）
- 切換至 Chrome 或 Safari 最新版本

---

### 13.2 我需要自己建立路由模型（建模）嗎？

**簡短回答：初期不需要。**

`nav.html` 目前使用 **OSRM 公開示範 API**（`router.project-osrm.org`）作為路由引擎，無需任何設置即可使用。這個 API 是免費的，適合開發和測試階段。

| 方案 | 需要自建？ | 適合階段 | 限制 |
|------|-----------|---------|------|
| **OSRM 公開 Demo API**（現用） | ❌ 不需要 | 開發 / 測試 | 官方不建議生產使用，偶爾回應較慢，無 SLA 保障 |
| **GraphHopper 免費 API** | ❌ 不需要 | MVP / 早期生產 | 每日 500 次免費路由請求，超出需付費 |
| **Brouter（純前端 WASM）** | ❌ 不需要 | 長期 / 離線 | 需下載路由數據（約幾十 MB），首次加載較慢 |
| **OSRM 自架伺服器** | ✅ 需要自架 | 大規模生產 | 需要 VPS 並自行處理 OpenStreetMap 數據提取 |

#### 「建模」是什麼意思？

在導航語境中，「建模」通常指**處理 OpenStreetMap（OSM）原始地圖數據，提取香港單車徑網絡，生成路由圖（routing graph）**。這需要：

1. **下載 OSM 香港數據**（約 100–200 MB .osm.pbf 文件）
2. **使用 OSRM 工具鏈處理**（需要 4–8 GB RAM，處理時間約 5–15 分鐘）
3. **啟動 OSRM 服務**（需要 VPS 或雲端伺服器）

對於 CTRC HK 初期而言，**完全不需要自建模型**，直接使用上表的免費方案即可。

#### 推薦路線：GraphHopper 免費 API（中期過渡方案）

如果 OSRM Demo API 不夠穩定，建議切換至 [GraphHopper 免費 API](https://docs.graphhopper.com)：

```javascript
// 替換 nav.html 中的 OSRM_BASE 常量：
// const OSRM_BASE = 'https://router.project-osrm.org/route/v1/bike';  // 舊
// 使用 GraphHopper：
const GH_API_KEY = 'your-free-api-key';  // 從 graphhopper.com 免費獲取
async function planRoute() {
  const url = `https://graphhopper.com/api/1/route?point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=bike&locale=zh-CN&key=${GH_API_KEY}&type=json&instructions=true`;
  // ...
}
```

GraphHopper 免費計劃提供每日 500 次路由請求，對於初期用戶量完全足夠。

---

## 參考資料

| 資源 | 連結 |
|------|------|
| Leaflet.js（Web 地圖） | https://leafletjs.com |
| leaflet-gpx | https://github.com/mpetazzoni/leaflet-gpx |
| MapLibre GL JS | https://maplibre.org |
| OpenFreeMap（免費向量圖磚） | https://openfreemap.org |
| OpenMapTiles 樣式規範 | https://openmaptiles.org/schema |
| Overpass Turbo（OSM 查詢工具） | https://overpass-turbo.eu |
| Web Push Notifications（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Push_API |
| iOS PWA 推送通知支援 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ |
| Web Geolocation API（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API |
| Web Speech API（報站語音） | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| Service Worker（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API |
| Web App Manifest（MDN） | https://developer.mozilla.org/en-US/docs/Web/Manifest |
| GPX 格式規範 | https://www.topografix.com/gpx.asp |
| Expo 文檔（日後 React Native） | https://docs.expo.dev |
| OpenStreetMap 單車徑數據 | https://www.openstreetmap.org |
| GraphHopper Routing API | https://docs.graphhopper.com |
| OSRM（開源路由機） | http://project-osrm.org |
| Brouter（離線單車路由） | https://brouter.de |
| 香港政府地理資訊（GeoData） | https://geodata.gov.hk |

---

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
