# 城市運輸單車 App 開發紀錄 v2

> 本文件記錄 2026-03 版本的主要改動，以及下一步的開發計劃。

---

## 本次主要改動

### 1. 🔀 網頁 / App 完全分工

| 頁面 | 網頁（瀏覽器） | App（PWA 安裝後） |
|------|--------------|-----------------|
| `index.html` | 品牌首頁、關於簡介、路線預覽、會員計劃 | 全新 App 主頁（用戶數據、一鍵騎行、最近紀錄） |
| `routes.html` | 路線列表（帶篩選、搜索） | 全新騎行頁（地圖 + 路線選擇 + 開始騎行） |
| `route_detail.html` | 路線詳細資料（描述、GPX、站點）| 隱藏「開始騎行」按鈕（App 專用） |

技術實現：CSS 類別 `.web-only` / `.app-only` + `body.is-pwa`（由 `js/pwa.js` 注入）

---

### 2. 🎨 App 配色更新（深綠主題）

**舊配色**：`#2c3e50`（深藍黑）+ `#BFE340`（亮黃綠）+ `#04D93C`（亮綠）

**新配色**（App 專用 CSS 變量）：
| 變量 | 色值 | 用途 |
|------|------|------|
| `--app-bg-primary` | `#121f14` | 主背景（深墨綠） |
| `--app-bg-secondary` | `#1a2e1a` | 次背景 |
| `--app-bg-card` | `#1e3820` | 卡片背景 |
| `--app-accent` | `#6dba65` | 主色調（中深綠） |
| `--app-accent-bright` | `#4caf50` | 按鈕高亮綠 |
| `--app-text-primary` | `#e8f5e9` | 主文字（淺綠白） |
| `--app-text-secondary` | `#a8d8a0` | 次文字 |

**網頁**：保持原有 `#2c3e50` / `#BFE340` 配色不變。

---

### 3. 🏠 App 主頁大改版

全新 App 主頁（`#app-home`）包含：
- **頂部欄**：Logo + 個人資料按鈕
- **用戶數據卡**：等級徽章、稱號、XP 進度條（配合新的 50 級系統）、騎行次數、總 XP、里程幣
- **一鍵開始騎行** CTA 按鈕
- **快捷功能**：騎行地圖、我的進度、個人資料、任務（天氣已移除）
- **最近騎行記錄**（最多顯示 5 條，從 API 實時載入）
- 未登入狀態：顯示「登入 / 註冊」引導

---

### 4. 🚴 App 騎行頁面大改版

全新騎行頁面（`#app-ride-page`）包含：
- **搜索欄**：支持搜索路線編號、別稱、總站名稱
- **篩選器**（橫向滑動 chip）：全部、已解鎖、通勤、旅遊、循環線、新手推薦、長途 + 🎲 隨機按鈕
- **Leaflet 地圖**（CartoDB 深色主題）：顯示將軍澳區全貌，標注各大總站
- **車站標記**：點擊地圖上的車站圖示，篩選只顯示該總站出發的路線
- **路線卡**：顯示路線ID、別稱、起訖站、時間、距離、鎖定狀態、XP 獎勵
- **路線選擇模式**：點擊路線卡後高亮選中，並在地圖上繪制路線（從 GPX 文件載入）
- **方向選擇按鈕**：每條路線每個方向獨立選擇
- **開始騎行按鈕**：選定路線和方向後，跳轉至 `/ride?id=XXX&dir=N`

---

### 5. ♾️ 等級系統改版（50 級 / 無上限設計）

**舊系統**：20 級上限，每 3-4 級解鎖新路線批次

**新系統**：
- 共定義 50 個等級（配置在 `routes.json`），第 51 級起按公式延伸（無硬性上限）
- **稱號**：每 10 級一個稱號（新手騎士 → 城市騎手 → 路線達人 → 都市傳奇 → 殿堂騎士）
- **解鎖批次間距加大**（約每 7-10 級解鎖一批）：

| 等級 | 解鎖路線 |
|------|---------|
| Lv.1 | 900, 900A, 966 |
| Lv.8 | 914, 966A |
| Lv.15 | 900S, 901P, 910, 914B |
| Lv.22 | 914H, 920, 966B |
| Lv.30 | 920X, 923, 966C |
| Lv.38 | 928, 929, 966T, 961, 961P |
| Lv.45 | 932, 935, 939, 939M, 962, 962A |
| Lv.50 | 955, 955A, 955H, 960, 962P, 962X, X935, S90, S91 |

- XP 需求（部分）：Lv.20 = 29,700 XP、Lv.30 = 117,400 XP、Lv.50 = 934,300 XP

---

### 6. 📍 GPS 修正

問題：開始騎行後 GPS 經常不響應。

修正方案（`ride.html`）：
1. 先呼叫 `getCurrentPosition()` 觸發系統權限對話框（立即彈出）
2. 收到第一個位置後才啟動 `watchPosition()` 連續追蹤
3. 即使 `getCurrentPosition` 失敗，仍嘗試啟動 `watchPosition`（確保重試）
4. `maximumAge` 改為 `0`（不使用快取，總是獲取最新位置）
5. `timeout` 增至 20 秒（給系統更多時間回應）

---

### 7. 🔔 推送通知說明

推送通知功能已在 `js/pwa.js` 中實作 `requestNotificationPermission()` 和 `sendLocalNotification()`。
在 `ride.html` 中，通過 `window.CTRCHK_PWA.sendLocalNotification()` 在到達站點時發出本地通知。

**如何測試：**
1. 在 HTTPS 環境中開啟 App（已安裝 PWA 或本地 localhost）
2. 進入騎行頁面，系統會彈出通知權限請求
3. 允許後，每到達一個站點會自動推送本地通知

**注意**：iOS Safari 要求 PWA 安裝到主屏幕後才支援通知，且只支援本地通知（不支援後台推送）。

---

## 下一步計劃

### 近期（高優先）

- [ ] **各路線沿途站點 GPS 座標**：等候站點資料，填入 `routes.json` 的 `stops` 欄位
- [ ] **各路線解鎖機制細節**：等候確認，然後完善 ROUTE_UNLOCK 表
- [ ] **路線地圖站點標記**：在騎行地圖上顯示各路線沿途站點
- [ ] **App 騎行頁面 - 方向篩選**：目前地圖上每個方向是同一路線的不同 GPX，待站點資料後可進一步優化
- [ ] **測試 GPS 修正效果**：在 iOS 和 Android 設備上實際測試 GPS 啟動

### 中期

- [ ] **app profile / 個人資料頁**：改為 App 風格（深綠主題）
- [ ] **app dashboard / 進度頁**：改為 App 風格，顯示解鎖進度
- [ ] **英文版 app 頁面**：`/en/routes.html` 和 `/en/index.html` 同樣需要 app-only 版本
- [ ] **路線詳情頁 app 版**：目前 route_detail.html 的「開始騎行」按鈕已設為 app-only；可進一步優化 App 風格
- [ ] **里程幣商店**（規劃中）

### 長期

- [ ] **沙田區路線**：增加沙田區地圖和路線
- [ ] **成就系統**：基於騎行次數、路線多樣性等條件解鎖成就
- [ ] **排行榜**：顯示等級/XP 排名
- [ ] **後台推送通知**：需要後端 Web Push API 支援（超出現有 Vercel Hobby 限制）

---

## 檔案變更摘要

| 檔案 | 改動內容 |
|------|---------|
| `index.html` | 新增 App 主頁（app-only），原內容改為 web-only |
| `routes.html` | 新增 App 騎行頁（app-only, 地圖+路線選擇），原內容改為 web-only |
| `route_detail.html` | 「開始騎行」section 改為 app-only；更新 ROUTE_UNLOCK 表 |
| `ride.html` | GPS 修正；更新 LEVEL_XP 至 50 級；更新 ROUTE_UNLOCK 表 |
| `css/main.css` | 新增 App 深綠主題 CSS 變量；更新 #app-bottom-nav 樣式；新增 Leaflet tooltip 樣式 |
| `js/pwa.js` | 底部導航「路線」→「騎行」（fa-biking 圖示）；更多面板改為深綠主題 |
| `js/main.js` | ROUTE_UNLOCK 更新至新解鎖等級 |
| `api/getHistory.js` | calcLevel() 改為無上限（50+ 級支援）；移除 Math.min(level, 20) 上限 |
| `routes.json` | level_config 擴充至 50 級；更新說明文字 |

---

## 技術備注

- App/Web 分離機制：CSS `.web-only`/`.app-only` + `body.is-pwa`（`navigator.standalone`）+ CSS media query `(display-mode: standalone)`
- Leaflet 地圖使用 CartoDB 深色磚塊（符合深綠主題）
- 站點 GPS 座標目前為估算值，待實地採集數據後更新
- 推送通知使用 Web Notifications API（本地通知），不需要後端支援

---

*最後更新：2026-03*
