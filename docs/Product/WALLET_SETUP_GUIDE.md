# Apple & Google Wallet 電子卡包配置與實時刷新設置指南 (Wallet Setup & Live Push Guide)

本指南旨在幫助 CTRC HK (香港城市運輸單車) 平台開發人員與系統管理員，完成對 **Apple Wallet** 和 **Google Wallet** 電子卡包的初始配置、密鑰配置以及實時刷新推送 (WebService Live Push) 機制的設置。

---

## 1. 核心機制簡介 (Core Architecture)

CTRC HK 的電子卡面實體整合採用了 **WalletWallet** 的 RESTful 整合接口，避免了昂貴的 Apple 開發者認證（$99/年）以及繁瑣的 Google Merchant/Wallet Profile 設計工作。

系統各層職責如下：
- **卡包建立**：當用戶在 `mileage.html` (里程計劃) 中點擊「將里程卡加入電子錢包」按鈕時，前端將請求發送至 `/api/user?action=wallet-pass`，後端調用 WalletWallet API 生成 Apple `.pkpass` 包（或 Google Wallet 保存鏈接），將 `serialNumber` 序號寫入數據庫 `user_game_profile.wallet_serial` 欄位中，然後 302 重定向至卡包安裝頁面。
- **動態更新與實時 Push**：當用戶騎行結束並在 `api/getHistory.js` 中成功提交新騎行記錄後，後端利用 `lib/wallet-helper.js` 中封裝的 `triggerWalletPassUpdate(userId, host, protocol)` 工具**異步、非阻塞地**向 WalletWallet 發送 `PUT /api/passes/<wallet_serial>` 更新請求。WalletWallet 將在數秒內，通過 APNs (Apple Push Notification service) 向用戶的 iOS 設備推送刷新通知（鎖屏 Banner 提示），並通過 Google 推送渠道同步刷新 Android 設備卡面包裝。

---

## 2. API 密鑰與環境變量配置 (Environment Variables)

在 **Vercel** 部署控制台、本地 `.env` 配置文件或環境變量管理器中，配置以下字段：

| 環境變量名稱 | 說明 | 默認/測試值 |
| :--- | :--- | :--- |
| `WALLETWALLET_API_KEY` | WalletWallet 的 Live API 金鑰，用於認證調用 | `ww_live_22f7b69fddac4dd40890d494fcbc4682` |
| `TEMPLATE_GOLD` | 金卡等級卡面包裝模板 UUID 網址 | `https://api.walletwallet.dev/p/40c18c8f-06ba-46aa-a36d-dc83279142e3` |
| `TEMPLATE_SILVER` | 銀卡等級卡面包裝模板 UUID 網址 | `https://api.walletwallet.dev/p/b9b7b535-2f0e-486e-81d2-d0fc86b3890f` |
| `TEMPLATE_BRONZE` | 銅卡等級卡面包裝模板 UUID 網址 | `https://api.walletwallet.dev/p/e5940b6a-c7d2-43c6-8bcd-f6bc03183b1d` |

> *備註：當前的 API 金鑰和模板 UUID 已經完全硬編碼在 `api/user.js` 以及 `lib/wallet-helper.js` 中作為了默認配置（Default Fallbacks）。在測試和一般運行時無需額外配置環境變量。如需變更為您自己的 WalletWallet 賬號，可在後台修改相應字段。*

---

## 3. 模版設計 (Designing Pass Templates)

若要更換或自定義卡面包裝（如更換背景圖、調整字體或排序字段），可登录 [WalletWallet 控制台](https://www.walletwallet.dev/)：

1. **新建/編輯模板**：
   - 創建三個分別對應 Gold, Silver, Bronze 三個等級的 Membership Card / Loyalty Card 類型的模板。
2. **字段綁定與命名**：
   - 為了保證數據正確解析，模板在後台設置時必須配有以下三個字段：
     - **Primary Field**：
       - `MEMBER`：對應顯示車手的 full_name 姓名或用戶名。
     - **Secondary Fields**：
       - `MILEAGE`：對應顯示累計 365 天滾動里程數，如 `123.4 km`。
       - `RANK`：對應顯示級別，如 `Gold 金卡`、`Silver 銀卡`、`Bronze 銅卡`。
     - **Header Field**：
       - `LEVEL`：對應顯示玩家當前等級，如 `Lv.12`。
3. **色彩設計 (Cohesive Glass Color Mapping)**：
   - **金卡**：背景底色設置為黑色或深灰，文字與高亮部分使用 `#F0D372` 金黃色，完美呼應 CTRC 的 `rank-gold` 黑金高對比度主題。
   - **銀卡**：底色使用金屬灰或深綠，高亮部分使用 `#D1D9DF` 科技銀灰色。
   - **銅卡**：底色使用暗綠，高亮部分使用 `#D8A56B` 古典銅褐色。
4. **二維條碼 (QR Barcode)**：
   - 將二維碼值設置為 `CTRC-USER-{userId}`。當車手在合作商戶線下結算或參加線下車友聚會時，管理員/商戶掃描此 QR Code 即可快速檢索其車手信息。

---

## 4. 本地開發與調試 (Local Development & Sandbox Testing)

由於 WalletWallet API 服務器部署在公網，無法在生成卡面時加載 `localhost` 的圖片作為 logo，因此系統代碼做出了智能適應：

1. **Logo 圖片自動適應**：
   - 當代碼檢測到 `req.headers.host` 包含 `localhost`、`127.0.0.1` 或 `sandbox` 等本地調試標誌時，會將 `logoURL` 自動切換至 GitHub 上的公共 Material Directions Bike 圖標。
   - 在生產環境（如 Vercel 部署上線）中，系統會自動切換為您的真實 HTTPS 域名下的 `/images/logo.png`，無需手動修改代碼。
2. **驗證實時更新 API**：
   - 您可以使用 `curl` 直接模擬一個騎手結束騎行的提交，驗證 Wallet 內容是否發生變化：
     ```bash
     curl -X POST https://your-app-domain.com/api/getHistory \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <JWT_ACCESS_TOKEN>" \
       -d '{
             "ride_date": "2026-07-25",
             "distance_km": 5.4,
             "duration_minutes": 20,
             "avg_speed_kmh": 16.2,
             "ride_mode": "commuter"
           }'
     ```
   - 提交成功後，觀察終端日誌 `[WalletUpdate] Successfully updated and pushed Wallet pass...`。您的手機卡面上，`MILEAGE` 數值會瞬間在背景完成刷新。

---

## 5. 常見問題與排查 (Troubleshooting)

### Q1: 安裝卡包時提示 "卡包無效" 或無法下載？
- **排查方法**：
  1. 請檢查您的 `WALLETWALLET_API_KEY` 是否有效或是否過期。
  2. 檢查 `api/user.js` 中的三個 Template UUID (TEMPLATE_GOLD/SILVER/BRONZE) 是否填寫正確，且必須處於 Active 狀態。
  3. 確保服務器公網在生產環境中可以成功加載並訪問 `logoURL` 指向的 `/images/logo.png`。

### Q2: 騎行結束了，但手機上的卡片里程數據沒有變更？
- **排查方法**：
  1. 檢查用戶的數據庫表記錄 `user_game_profile` 中是否已存有對應的 `wallet_serial`。
  2. 只有在用戶首次在 `mileage.html` 點擊安裝卡包並重定向後，卡包序號才會被寫入。如果用戶直接用其他方式打開或在未綁定前騎行，將無法接收到推送。
  3. 檢查您的 Server 運行日誌，尋找帶有 `[WalletUpdate]` 的日誌輸出，查看是否有報錯或 network timeout。

---
&copy; 2026 CTRC HK 核心工程委員會. 版權所有。
