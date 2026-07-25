# CTRC HK 電子錢包 (Wallet Pass) 與過期里程預警開發者配置及部署手冊
<!-- 版本: v2.1.3-Beta -->
<!-- 適用對象: 未來人類開發者、高級維護團隊、AI 代理 -->

本手冊將詳細說明 **CTRC HK** 的里程卡未來 30 天過期預警系統（Task P1-1）與 Apple & Google Wallet 電子錢包卡包實時自動更新與動態 Push 推送通知（Task P1-2）的底層技術細節、數據庫遷移、配置參數與調試驗證流程。

---

## 第一章：滾動里程過期預警 (Task P1-1)

### 1.1 技術架構與算法
CTRC HK 的里程卡（銅、銀、金）採用 365 天滾動總里程算法。
- **保級壓力預警** 的核心是：在未來 30 天內，每天有哪些一年前的歷史騎行里程即將從滾動統計中滑出並被扣除。
- 後端算法實現在 `api/user.js` 與 `api/getHistory.js` 中：
  1. 獲取用戶在最近 365 天內的所有歷史騎行記錄（`ride_date >= CURRENT_DATE - INTERVAL '365 days'`）。
  2. 在 JavaScript 內清除時間戳記影響，精確計算每條記錄相對於今天的年齡（`ageInDays`）。
  3. 當 `336 <= ageInDays && ageInDays <= 365` 時，這些記錄將在未來的 `365 - ageInDays` 天內陸續過期。
  4. 分別累加每天的失效值，組成一個長度為 30 的細分日歷數據並對外返回。

### 1.2 前端可視化渲染
在 `mileage.html` 中：
- 渲染一個自適應、高亮、高可讀性的柱狀圖（Pure HTML/CSS），當天失效里程越高，柱子越高，且顏色會依過期程度由綠、藍、黃向紅（Danger）警告漸變。
- 此外，下方會自動展示未來 30 天失效明細清單。若 30 天內無任何過期里程，則自動顯示祝賀文案 `🎉 太棒了！未來 30 天內沒有即將過期的里程。`

---

## 第二章：電子錢包卡包實時刷新 (Task P1-2)

### 2.1 數據庫表擴展
為了使電子錢包卡片在用戶端的手機（Apple Wallet / Google Wallet）內可被更新，我們在數據庫 `user_game_profile` 表中擴增了 `wallet_serial_number` 欄位以持久化存儲 WalletWallet API 生成的 Pass 唯一的序列號（Serial Number）。

*此欄位已在 `api/user.js` 和 `api/getHistory.js` 啟動時自動遷移新增，無需開發者手動執行。*

如果需要手動在 Neon / PostgreSQL 控制台中執行，可使用以下 SQL：
```sql
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS wallet_serial_number VARCHAR(100);
```

### 2.2 WalletWallet API 接口規格
我們接入了 **WalletWallet** (https://walletwallet.dev) 接口。本項目中的免費通道 API KEY 及模板預設配置如下：
*   **API Key**: `ww_live_22f7b69fddac4dd40890d494fcbc4682`
*   **Gold Template (金卡模板)**: `https://api.walletwallet.dev/p/40c18c8f-06ba-46aa-a36d-dc83279142e3`
*   **Silver Template (銀卡模板)**: `https://api.walletwallet.dev/p/b9b7b535-2f0e-486e-81d2-d0fc86b3890f`
*   **Bronze Template (銅卡模板)**: `https://api.walletwallet.dev/p/e5940b6a-c7d2-43c6-8bcd-f6bc03183b1d`

#### 核心流程
1.  **卡包下載與自癒 (`api/user?action=wallet-pass`)**:
    *   查詢用戶的 `wallet_serial_number`。
    *   如果已註冊序列號：後端發起 `PUT https://api.walletwallet.dev/api/passes/<serial>` 更新卡面包裝數據。如果返回 `200`，則直接 302 跳轉至卡包下載頁。若返回非 `200`（如卡包已被刪除或過期），則清空序列號並進入 `POST` 流。
    *   如果未註冊序列號（或已失效）：發起 `POST https://api.walletwallet.dev/api/passes` 創建卡包，得到 `serialNumber`，更新至數據庫，並跳轉至安裝頁。
2.  **實時異步背景推送 (`lib/wallet.js`)**:
    *   當用戶 **騎行結算成功** 或 **每日簽到** 時，後端在完成數據結算後，會異步發起對 WalletWallet 的 `PUT` 更新請求。
    *   WalletWallet 服務端將異步通知 Apple APNs 及 Google Wallet 刷新通道。骑士的手機將在數秒內靜默完成卡面包裝數據刷新，並直接在騎士手機鎖屏上顯示動態通知：
        *   里程刷新：*“您的近 365 天總里程已更新為 [最新里程] km”*
        *   等級提升：*“恭喜！您的等級已提升至 Lv.[最新等級]”*

---

## 第三章：開發者調試、測試與驗證

### 3.1 本地調試環境
1.  **域 (Domain) Fallback 保護機制**:
    在本地 `localhost` 環境下，WalletWallet 的 API 服務器無法回訪你本地的圖片地址。代碼中已內建環境檢測：當檢測到請求來源為 `localhost` 或沙盒環境時，會自動將卡片 Logo URL 回退至 GitHub 上的公共 high-res directions_bike 圖標，防止 WalletWallet 拋出圖標拉取失敗報錯。
2.  **模擬請求與日誌查看**:
    *   開發者可通過 Node.js 執行腳本來手動模擬 Wallet pass 更新。
    *   在 Vercel 部署控制台中，篩選 `/api/getHistory` 或 `/api/user` 的實時日誌，可以清晰看到 `[updateWalletPassForUser] Wallet pass successfully updated & pushed` 等成功提示日誌。

### 3.2 自定義模板或更換 API Key
若未來平台需要切換為自有的 WalletWallet 付費帳號，請執行以下步驟：
1.  在 WalletWallet 控制台創建對應 Apple Wallet 及 Google Wallet 的銅、銀、金 3 套會員卡模板。
2.  修改 `/lib/wallet.js` 與 `/api/user.js` 中的常量定義：
    ```javascript
    const WALLETWALLET_API_KEY = "ww_live_your_private_api_key_here";
    const TEMPLATE_GOLD = "https://api.walletwallet.dev/p/your_gold_template_uuid";
    const TEMPLATE_SILVER = "https://api.walletwallet.dev/p/your_silver_template_uuid";
    const TEMPLATE_BRONZE = "https://api.walletwallet.dev/p/your_bronze_template_uuid";
    ```
3.  模板欄位對接配置：
    確保模板中定義了以下三個字段以供綁定和接收 %@ 變量：
    *   `primaryFields` 第一欄: `MEMBER`（用戶姓名）
    *   `secondaryFields` 第一欄: `MILEAGE`（總里程，附加 `changeMessage`）
    *   `secondaryFields` 第二欄: `RANK`（會員級別，附加 `changeMessage`）
    *   `headerFields` 第一欄: `LEVEL`（用戶等級，附加 `changeMessage`）

---
&copy; 2026 CTRC HK (香港城市運輸單車) 核心工程委員會. 版權所有。
