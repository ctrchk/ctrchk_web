# CTRC HK 騎行 App 開發探討（遊戲化 PWA 版本）

> 本文件探討 CTRC HK 官方 App 的開發方向，以遊戲化玩法為核心設計理念，  
> 並採用 **PWA（漸進式 Web App）** 作為首要技術方案，利用現有前端技術零成本落地。  
> 此為規劃文件，**不需要立即實施**，但可作為日後開發的參考藍圖。

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

## 參考資料

| 資源 | 連結 |
|------|------|
| Leaflet.js（Web 地圖） | https://leafletjs.com |
| leaflet-gpx | https://github.com/mpetazzoni/leaflet-gpx |
| MapLibre GL JS | https://maplibre.org |
| Web Push Notifications（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Push_API |
| iOS PWA 推送通知支援 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ |
| Web Geolocation API（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API |
| Web Speech API（報站語音） | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| Service Worker（MDN） | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API |
| Web App Manifest（MDN） | https://developer.mozilla.org/en-US/docs/Web/Manifest |
| GPX 格式規範 | https://www.topografix.com/gpx.asp |
| Expo 文檔（日後 React Native） | https://docs.expo.dev |

---

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
