# CTRC HK 騎行 App 開發探討

> 本文件探討未來 CTRC HK 官方 App 的開發方向、技術選型及與現有網站/後台的整合方案。  
> 此為規劃文件，**不需要立即實施**，但可作為日後開發的參考藍圖。

---

## 目錄

1. [概念與目標](#1-概念與目標)
2. [核心功能清單](#2-核心功能清單)
3. [技術選型比較](#3-技術選型比較)
4. [與現有網站整合](#4-與現有網站整合)
5. [需要新增的 API 端點](#5-需要新增的-api-端點)
6. [資料庫變更](#6-資料庫變更)
7. [路線導航實現方案](#7-路線導航實現方案)
8. [儀表板同步方案](#8-儀表板同步方案)
9. [開發路線圖](#9-開發路線圖)
10. [開放問題與待決定事項](#10-開放問題與待決定事項)

---

## 1. 概念與目標

### 核心概念

用戶在 App 內選擇一條 CTRC 路線並開始騎行，App 會：

1. 在地圖上顯示 GPX 路線走向
2. 用 GPS 定位追蹤用戶的實時位置
3. 在路線上標示用戶當前進度
4. 騎行結束後自動記錄數據（距離、時間、速度等）
5. 將騎行紀錄同步至 **CTRC 網站的儀表板**（`/dashboard`），讓用戶在電腦和手機均可查看

### 目標用戶體驗

```
用戶打開 App
  → 選擇路線（如：900 市區海濱線）
  → 查看路線地圖（GPX 疊加在地圖上）
  → 點擊「開始騎行」
  → 地圖上實時顯示當前位置，並沿路線導航
  → 到達終點（或手動結束）
  → 顯示騎行總結（距離、時間、平均速度）
  → 數據自動上傳至儀表板，網站端亦可查閱
```

---

## 2. 核心功能清單

### 必要功能（MVP）

| 功能 | 說明 |
|------|------|
| 用戶登入 | 使用現有 JWT / Google OAuth，與網站共用帳號 |
| 路線瀏覽 | 列出所有 CTRC 路線（同步自網站路線數據） |
| 路線地圖 | 將 GPX 檔案疊加到地圖顯示路線走向 |
| 實時定位導航 | 用 GPS 追蹤用戶位置，顯示在路線地圖上 |
| 騎行記錄 | 記錄距離、時間、開始/結束時間 |
| 儀表板同步 | 騎行結束後上傳數據至後台，網站儀表板可查閱 |
| 高級會員 GPX 下載 | 高級會員可在 App 內下載 GPX 至 GPS 設備 |

### 進階功能（未來版本）

| 功能 | 說明 |
|------|------|
| 離線地圖 | 預先下載地圖瓦片，無網絡亦可導航 |
| 語音導航提示 | 到達關鍵路口時發出語音提示 |
| 成就系統 | 完成特定路線或里程解鎖徽章 |
| 路線完成率 | 追蹤用戶已完成的路線百分比 |
| 社群功能 | 查看同路線其他騎手的動態（可選） |
| Apple Watch / Wear OS | 在智慧手錶上顯示導航提示和騎行數據 |
| CarPlay / Android Auto | 在車載屏幕顯示路線（未來考慮） |

---

## 3. 技術選型比較

### 方案 A：React Native（推薦）

```
優點：
  ✅ 一套代碼同時生成 iOS 和 Android App
  ✅ JavaScript/TypeScript — 與現有網站技術棧接近，學習曲線低
  ✅ 豐富的地圖庫（react-native-maps、Mapbox）
  ✅ 社群活躍，文檔完善
  ✅ Expo 框架可大幅簡化初期開發和測試流程

缺點：
  ❌ 部分原生功能（如後台 GPS）仍需原生代碼
  ❌ 效能略低於純原生（對路線導航影響不大）

建議入門方式：使用 Expo（https://expo.dev）快速搭建原型
```

### 方案 B：Flutter

```
優點：
  ✅ Google 官方支援，一套代碼覆蓋 iOS、Android、Web
  ✅ 高效能，UI 渲染不依賴原生組件
  ✅ 地圖支援良好（flutter_map、Google Maps）

缺點：
  ❌ 使用 Dart 語言，需要額外學習
  ❌ App 包體積相對較大

適合：如果日後希望 App 也有 Web 版本
```

### 方案 C：PWA（漸進式 Web App）

```
優點：
  ✅ 直接在現有網站上擴展，無需獨立 App 開發
  ✅ 無需上架 App Store / Google Play
  ✅ 與現有 HTML/CSS/JS 技術完全一致
  ✅ 可以「加至主屏幕」，使用體驗接近原生 App

缺點：
  ❌ iOS Safari 對後台 GPS 支援有限（Apple 限制）
  ❌ 無法使用部分原生感測器（如較精準的加速計）
  ❌ 離線地圖實現較複雜

適合：快速推出可用版本，日後再遷移至原生 App
```

### 方案 D：原生 iOS（Swift） + 原生 Android（Kotlin）

```
優點：
  ✅ 最佳效能和原生 GPS/地圖體驗
  ✅ 完整使用所有系統功能（後台定位等）

缺點：
  ❌ 需要分別開發兩個 App，工作量翻倍
  ❌ 需要 Swift + Kotlin 雙語言能力

適合：有豐富原生開發資源的情況
```

### 建議路線

```
第一階段：PWA（最快落地）
  → 現有網站加上 Service Worker + GPS API
  → 用戶「加至主屏幕」即可使用，無需上架

第二階段：React Native + Expo（正式 App）
  → 完整 iOS + Android App
  → 後台 GPS 追蹤，離線地圖
  → 上架 App Store 和 Google Play
```

---

## 4. 與現有網站整合

### 現有可直接複用的資源

| 資源 | 說明 | 如何在 App 中使用 |
|------|------|-----------------|
| JWT 認證 | `POST /api/login`、`POST /api/google-auth` | App 登入後存儲 JWT token，後續 API 調用帶上 Bearer token |
| 用戶數據 | `GET /api/get-user` | 獲取用戶名、會員等級、是否高級會員 |
| 騎行歷史 | `GET /api/getHistory` | 在 App 內顯示歷史紀錄 |
| GPX 路線文件 | `/gpx/*.gpx`（靜態文件） | App 直接讀取解析 GPX，疊加到地圖 |
| 路線數據 | `js/main.js` 中的 `routes[]` 陣列 | 抽取為獨立 JSON API（見下方） |
| 高級會員判斷 | `user_role === 'senior'` | App 內限制 GPX 下載和完整路線詳情 |

### 認證流程（App 端）

```
1. 用戶在 App 輸入電郵/密碼
   → POST /api/login
   → 獲得 JWT token（有效期 7 天）
   → 存儲於 SecureStore（React Native）

2. 或使用 Google 登入
   → 調用 Google OAuth，獲得 id_token
   → POST /api/google-auth { idToken }
   → 獲得 JWT token

3. 後續所有 API 請求帶上：
   Authorization: Bearer <token>

4. Token 過期時自動跳轉登入頁
```

---

## 5. 需要新增的 API 端點

以下是 App 需要但現有網站尚未提供的 API：

### 5.1 路線數據 API

```
GET /api/routes
GET /api/routes?id=900

作用：以 JSON 格式提供路線數據（目前路線數據硬編碼在 main.js 中）

回應範例：
[
  {
    "id": "900",
    "alias": "市區海濱線",
    "start": "寶琳(新都城二期)",
    "end": "調景嶺彩明",
    "time": 40,
    "length": "5.5km",
    "difficulty": 3,
    "color": "#990000",
    "gpx": [
      { "label": "往寶琳", "file": "900寶琳.gpx" },
      { "label": "往調景嶺", "file": "900調景嶺.gpx" }
    ]
  }
]

注意：Vercel Hobby 目前已接近 12 個 Serverless Function 的上限，
      需要確認是否有空間（或使用 _db.js 的下劃綫命名規避計數）。
```

### 5.2 上傳騎行紀錄 API

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
  "gpx_track": "..."   // 可選：用戶實際騎行的 GPS 軌跡（GeoJSON 或 GPX）
}

回應：
{ "success": true, "ride_id": 123 }

作用：將 App 錄得的騎行數據寫入 cycling_history 資料表，
      網站儀表板即可顯示此紀錄。
```

### 5.3 騎行紀錄詳情 API（擴展現有 getHistory）

```
GET /api/getHistory （現有，略作擴展）

目前回應：[{ ride_date, distance_km, route_name }]
建議擴展至：
[{
  id, route_id, route_name, ride_date,
  distance_km, duration_minutes, avg_speed_kmh,
  start_time, end_time
}]
```

---

## 6. 資料庫變更

### 擴展 cycling_history 資料表

```sql
-- 為 cycling_history 增加更多騎行詳情欄位
ALTER TABLE cycling_history
  ADD COLUMN IF NOT EXISTS route_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS gpx_track TEXT,  -- 可選：實際騎行 GeoJSON/GPX
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
  -- source: 'web' (手動輸入) | 'app' (App 自動上傳) | 'gpx' (GPX 導入)

-- 新索引
CREATE INDEX IF NOT EXISTS idx_cycling_history_route_id
  ON cycling_history(route_id);
CREATE INDEX IF NOT EXISTS idx_cycling_history_start_time
  ON cycling_history(start_time);
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

## 7. 路線導航實現方案

### GPX 解析

CTRC 已有完整的 GPX 文件集（`/gpx/*.gpx`）。App 需要：

1. 讀取 GPX 文件（XML 格式）
2. 解析 `<trkpt>` 節點，提取經緯度序列
3. 在地圖上繪製路線

```javascript
// React Native 範例（使用 react-native-maps）
import * as FileSystem from 'expo-file-system';
import { XMLParser } from 'fast-xml-parser';

async function loadGpxRoute(routeId, direction) {
  const url = `https://ctrchk.com/gpx/${routeId}${direction}.gpx`;
  const content = await FileSystem.downloadAsync(url, ...);
  const parser = new XMLParser();
  const gpx = parser.parse(content);
  
  const points = gpx.gpx.trk.trkseg.trkpt.map(pt => ({
    latitude: parseFloat(pt['@_lat']),
    longitude: parseFloat(pt['@_lon']),
  }));
  
  return points;
}
```

### 實時 GPS 定位

```javascript
// React Native / Expo
import * as Location from 'expo-location';

async function startTracking() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  
  // 開始追蹤
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000 },
    (location) => {
      const { latitude, longitude, speed } = location.coords;
      updateUserPosition({ latitude, longitude });
      recordTrackPoint({ latitude, longitude, speed, timestamp: Date.now() });
    }
  );
  
  return subscription; // 騎行結束時調用 subscription.remove()
}
```

### 地圖推薦選項

| 地圖庫 | 費用 | 優點 |
|--------|------|------|
| **react-native-maps** (Google Maps) | 免費（每月前 $200 美元用量） | 最成熟，中文地名完整 |
| **MapLibre GL** | 完全免費開源 | 可使用免費地圖源（OpenStreetMap） |
| **Mapbox** | 免費層有月請求限制 | 高度可定制，離線地圖支援佳 |

> 💡 **建議**：初期使用 react-native-maps + Google Maps（免費層足夠），
> 正式上線後評估是否遷移至 MapLibre（節省成本）。

---

## 8. 儀表板同步方案

### 數據流向

```
App 騎行結束
    ↓
App 整理騎行數據（距離、時間、速度、GPS軌跡）
    ↓
POST /api/rides  （帶 JWT token）
    ↓
後端寫入 cycling_history 資料表
    ↓
用戶打開網站 /dashboard
    ↓
GET /api/getHistory  → 讀取 cycling_history
    ↓
儀表板顯示最新騎行紀錄 ✅
```

### 網站儀表板需要的更新

目前 `/dashboard.html` 的騎行歷史顯示較為簡單（只有日期和距離）。  
App 接入後，可考慮升級儀表板展示：

```
目前顯示：
  日期: 2026-03-09, 距離: 5.5 km

升級後可顯示：
  📍 900 市區海濱線  |  2026-03-09
  ⏱ 42 分鐘  |  🚴 5.5 km  |  💨 平均 7.9 km/h
  來源：CTRC App
```

---

## 9. 開發路線圖

### 第一階段：PWA 快速版（約 2-4 週）

```
目標：在不需要上架 App Store 的情況下，讓用戶能在手機上查看路線地圖。

工作項目：
  □ 為 /route_detail.html 加上 GPX 地圖顯示（使用 Leaflet.js）
  □ 加上 Service Worker，讓頁面可離線訪問
  □ 加上 Web App Manifest（讓用戶「加至主屏幕」）
  □ 加上瀏覽器 Geolocation API（顯示用戶位置）

局限：
  - iOS 無後台 GPS 支援
  - 地圖不能完全離線（需緩存瓦片）
```

### 第二階段：React Native App（約 2-3 個月）

```
目標：正式的 iOS + Android App，支援後台 GPS 追蹤。

工作項目：
  □ 搭建 Expo 項目結構
  □ 實現登入（JWT + Google OAuth）
  □ 路線列表頁（調用 /api/routes）
  □ 路線詳情 + GPX 地圖疊加
  □ 騎行記錄功能（實時 GPS + 距離/速度計算）
  □ 騎行結束頁（總結 + 上傳）
  □ 儀表板頁面（調用 /api/getHistory）
  □ 上架 App Store 和 Google Play
```

### 第三階段：進階功能（視資源而定）

```
  □ 離線地圖（MapLibre + 本地瓦片緩存）
  □ 語音導航提示
  □ 成就系統和徽章
  □ Apple Watch companion App
```

---

## 10. 開放問題與待決定事項

以下問題需要在正式開發前確認：

### 技術問題

- [ ] **地圖服務選擇**：Google Maps（需帳單設置）還是開源 OpenStreetMap？
- [ ] **Vercel Function 限額**：Hobby Plan 上限 12 個，新增 `/api/routes` 和 `/api/rides` 後是否超限？需要升級計劃或重構現有 API？
- [ ] **GPX 軌跡存儲**：用戶實際騎行的 GPS 軌跡是否需要存儲？若需要，存儲在資料庫（TEXT 欄位）還是對象存儲（如 Vercel Blob）？
- [ ] **App 簽名和上架**：需要 Apple Developer 帳號（$99/年）和 Google Play 帳號（$25 一次性費用）。

### 產品問題

- [ ] **App 名稱**：「CTRC HK」還是另起名稱？
- [ ] **離線支援程度**：用戶在路線中途若斷網，功能應如何降級？
- [ ] **GPX 數據是否向高級會員開放**：App 內的實時導航是否也需要高級會員才能使用？
- [ ] **用戶生成內容**：是否允許用戶上傳自己的騎行軌跡到社群分享？

### 近期可做的準備工作（不用立即開發 App）

- [ ] 將 `js/main.js` 中的路線數據抽取為 `/api/routes.js`，方便 App 調用
- [ ] 擴展 `cycling_history` 表，加入 `duration_minutes`、`avg_speed_kmh` 等欄位
- [ ] 在 `/dashboard.html` 上先準備好更豐富的騎行歷史展示格式
- [ ] 研究 Leaflet.js 在現有網站 route_detail 頁面上展示 GPX 地圖（PWA 前置步驟）

---

## 參考資料

| 資源 | 連結 |
|------|------|
| Expo 文檔 | https://docs.expo.dev |
| react-native-maps | https://github.com/react-native-maps/react-native-maps |
| Expo Location API | https://docs.expo.dev/versions/latest/sdk/location/ |
| Leaflet.js（Web 地圖） | https://leafletjs.com |
| MapLibre GL JS | https://maplibre.org |
| GPX 格式規範 | https://www.topografix.com/gpx.asp |
| App Store Connect | https://appstoreconnect.apple.com |
| Google Play Console | https://play.google.com/console |

---

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
