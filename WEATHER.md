# WEATHER 頁面說明（`/weather`）

本文檔完整說明 `weather.html` 與後端代理 `api/_weather/[dataType].js` 的用途、資料流程、錯誤處理、以及你後續要自行維護時的操作步驟。

---

## 1. 這個頁面是做什麼的

`/weather` 是「出發前快速看天氣」頁面，提供：

1. 即時溫度
2. 即時相對濕度
3. 天氣狀態摘要
4. 天氣警告摘要
5. 騎行建議（穩定/需留意）

資料來源為香港天文台 Open Data，但前端不直接打外部網址，而是走本站 API 代理：

- `GET /api/_weather/rhrread?lang=...`
- `GET /api/_weather/warnsum?lang=...`

---

## 2. 架構與檔案分工

### 前端

- 檔案：`/home/runner/work/ctrchk_web/ctrchk_web/weather.html`
- 功能：
  - 產生頁面 UI
  - 呼叫 weather API
  - 將資料渲染到 DOM
  - 當 API 失敗時顯示「天氣資料載入失敗，請稍後再試」

### 後端代理

- 檔案：`/home/runner/work/ctrchk_web/ctrchk_web/api/_weather/[dataType].js`
- 功能：
  - 驗證 `dataType` 是否在白名單
  - 轉發到 `https://data.weather.gov.hk/...`
  - 解析 JSON
  - 設定快取標頭（5 分鐘）
  - 回傳標準化錯誤

---

## 3. 前端運作邏輯（實際執行順序）

1. 進入頁面時執行 `initWeather()`
2. 先從 localStorage user 資料判斷 rank（gold/silver/bronze），顯示不同提示語
3. 同步請求兩個端點：
   - `rhrread`（主要資料：溫度、濕度、更新時間）
   - `warnsum`（警告資料）
4. 已加入語言 fallback：會依序嘗試 `tc -> zh -> en`
5. `rhrread` 成功才會進入 `renderWeather()`；失敗就顯示載入失敗
6. `warnsum` 若失敗，頁面仍可顯示主天氣資料（不會整頁掛掉）

---

## 4. 後端代理運作邏輯

`api/_weather/[dataType].js` 主要流程：

1. 檢查 request method（允許 GET / OPTIONS）
2. 讀取 `dataType` 與 `lang`
3. 驗證 `dataType` 是否在白名單：
   - `rhrread`
   - `warnsum`
   - `swt`
   - `fnd`
   - `flw`
   - `warningInfo`
4. 用 `fetch` 呼叫 HKO Open Data，含 10 秒 timeout
5. 讀取 response text 後自行 `JSON.parse`（避免 content-type 不標準導致前端判失敗）
6. 設定 `Cache-Control: public, max-age=300`
7. 回傳 JSON
8. 任何異常回傳 `500 { error: 'Failed to fetch weather data' }`

---

## 5. 為什麼之前會「載入失敗」

常見原因：

1. HKO 回應 header 不穩定（不是標準 `application/json`），但內容其實是 JSON
2. 上游網路慢或暫時超時
3. 前端只試一種語言參數，遇到語言相容性就直接失敗

目前修正：

1. 後端改為以 response text + JSON.parse 容錯處理
2. 後端加入 10 秒 timeout，避免長時間卡住
3. 前端加入 `tc -> zh -> en` fallback

---

## 6. 你之後要怎麼自己維護（逐步做法）

如果你要自行改這頁，建議按這個順序：

1. **先改 UI**
   - 檔案：`weather.html`
   - 只改 `.wx-*` 區塊與 DOM id，不動 API 名稱

2. **再改資料欄位映射**
   - `renderWeather()` 內調整資料來源欄位
   - 確保溫度/濕度/警告在資料缺失時有 fallback（`--`、`目前沒有警告`）

3. **最後改後端代理**
   - 檔案：`api/_weather/[dataType].js`
   - 若新增資料類型，先加到 `validTypes`
   - 保留 timeout + JSON parse 容錯 + cache header

4. **手動驗證**
   - 開啟 `/weather`
   - 觀察 `更新時間`、溫度、濕度是否正常
   - 斷網/模擬上游失敗時，確認頁面顯示「載入失敗」而不是白屏

---

## 7. 常用排錯清單（Checklist）

1. `/api/_weather/rhrread?lang=tc` 是否回 200
2. `/api/_weather/warnsum?lang=tc` 是否回 200
3. `dataType` 是否拼錯
4. 前端是否有把 `fetch` 錯誤吞掉（console 看錯誤）
5. 是否被舊快取影響（hard refresh）
6. deploy 平台的函式限制/路由是否正確

---

## 8. 未來可擴充方向

1. 新增「降雨機率」「雷達圖連結」
2. 警告分級顏色（黃/紅/黑）
3. 雨天騎行安全提示模板
4. 加入最近一次成功快取（API 暫時失敗也能顯示舊資料）

---

## 9. 相關檔案索引

- `/home/runner/work/ctrchk_web/ctrchk_web/weather.html`
- `/home/runner/work/ctrchk_web/ctrchk_web/api/_weather/[dataType].js`
- `/home/runner/work/ctrchk_web/ctrchk_web/js/pwa.js`（權限階級與 app/web 行為）
- `/home/runner/work/ctrchk_web/ctrchk_web/css/main.css`（全站主題樣式）

