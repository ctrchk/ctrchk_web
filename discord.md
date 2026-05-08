# CTRCHK Discord 完整教學（網站＋Bot 一次打通）

本文件是 CTRCHK Discord 整合的完整操作手冊，目標是讓你由零開始完成：

1. 建立 Discord 應用與 Bot  
2. 建立並對應 CTRCHK 三軌身份組  
3. 設定網站與 Bot 雙方環境變數  
4. 啟動 Bot 並與網站 API 互通  
5. 驗收所有功能（歡迎訊息、`/status`、身份組同步、Admin Relay）

> 用詞規範：統一使用香港術語 **車手、路線**（不要使用「騎手、線路」）。

---

## 0) 先理解你要做的是甚麼

CTRCHK 的 Discord 整合包含兩個系統：

- **網站（ctrchk_web）**：處理用戶登入、Discord 連結、後台操作
- **Discord Bot（discord-bot）**：在伺服器執行實際 Discord 操作（派發身份組、發訊息、回應指令）

兩者透過 Token 驗證互相呼叫 API。

---

## 1) 功能總覽（完成後你會得到甚麼）

- 新成員入群自動歡迎
- 用戶在網站連結 Discord 後，自動同步身份組
- 管理員可由後台透過 Bot 在指定頻道發官方公告（Admin Relay）
- `/status` 指令可顯示：
  - 里程卡類別
  - 里程幣餘額
  - 車手等級
  - 會員身份
- 限時活動：即日起至 **5/31**，首次成功連結 Discord 送 **100 里程幣**

---

## 2) 三軌系統定義（先確認規則再建身份組）

### 2.1 車手等級（Cyclist Level）

- Lv.1–5：入門車手
- Lv.6–15：初階車手
- Lv.16–30：進階車手
- Lv.31–50：資深車手
- Lv.51–75：精英車手
- Lv.76+：頂尖車手

### 2.2 里程計劃（Mileage Program）

- 銅卡
- 銀卡
- 金卡

### 2.3 會員身份（Membership Status）

- 普通會員（junior）
- 高級會員（senior）
- VIP 會員（vip）
- 管理員（admin）
- 高級管理員（senior_admin）

---

## 3) Discord 身份組對應（必做，缺一不可）

> 名稱可自訂，但實際綁定以 Role ID 為準。  
> 建議先照以下名稱建立，減少混亂。

### 3.1 車手等級 → 身份組

- 入門車手 → `CTRC 車手｜入門`
- 初階車手 → `CTRC 車手｜初階`
- 進階車手 → `CTRC 車手｜進階`
- 資深車手 → `CTRC 車手｜資深`
- 精英車手 → `CTRC 車手｜精英`
- 頂尖車手 → `CTRC 車手｜頂尖`

### 3.2 里程計劃 → 身份組

- 銅卡 → `CTRC 里程卡｜銅卡`
- 銀卡 → `CTRC 里程卡｜銀卡`
- 金卡 → `CTRC 里程卡｜金卡`

### 3.3 會員身份 → 身份組

- 普通會員 → `CTRC 會員｜普通`
- 高級會員 → `CTRC 會員｜高級`
- VIP 會員 → `CTRC 會員｜VIP`
- 管理員 → `CTRC 會員｜管理員`
- 高級管理員 → `CTRC 會員｜高級管理員`

---

## 4) 完整部署流程（由零開始）

## 4.1 建立 Discord App 與 Bot

1. 到 Discord Developer Portal 建立 Application。  
2. 進入 **Bot** 分頁建立 Bot。  
3. 開啟所需權限（最少）：
   - Manage Roles
   - Send Messages
   - Use Slash Commands
4. 把 Bot 邀請進你的 Discord 伺服器。  
5. 在伺服器身份組設定中，將 **Bot 角色放在所有 CTRCHK 目標身份組之上**。  
   - 否則 Bot 無法派發或更新身份組（最常見錯誤）。

## 4.2 開啟開發者模式並收集所有 ID

1. 在 Discord 用戶設定啟用「開發者模式」。  
2. 右鍵每個身份組，複製 Role ID。  
3. 右鍵伺服器圖示，複製 Guild ID。  
4. 選一個歡迎頻道，複製 Channel ID（新成員歡迎用途）。

請先把 ID 整理好，下一步會一次填入環境變數。

## 4.3 設定 Bot 環境變數（`discord-bot/.env` 或雲端平台環境變數）

> `discord-bot/.env` 只是本地開發的寫法。  
> 正式上線時，請把同名變數填到你實際部署 Bot 的雲端平台（Render/Railway/Fly.io/VM 等），不一定要存本地檔案。

先複製範本：

```bash
cd discord-bot
cp .env.example .env
```

然後逐項填寫：

### A. Bot 核心連線變數（必填）

- `DISCORD_BOT_TOKEN`  
  - 用途：Bot 登入 Discord。  
  - 去哪裡拿：Discord Developer Portal → 你的 App → Bot → Reset Token / Copy。  
  - 填寫格式：一整串 Token 字串（不要加引號）。

- `DISCORD_CLIENT_ID`  
  - 用途：註冊 `/status` 指令與識別應用。  
  - 去哪裡拿：Discord Developer Portal → General Information → Application ID。  
  - 填寫格式：純數字字串。

- `DISCORD_GUILD_ID`  
  - 用途：指定 Bot 操作的伺服器（同步身份組、註冊 guild 指令）。  
  - 去哪裡拿：Discord 伺服器右鍵 → 複製伺服器 ID。  
  - 填寫格式：純數字字串。

- `DISCORD_WELCOME_CHANNEL_ID`  
  - 用途：新成員歡迎訊息發送頻道。  
  - 去哪裡拿：目標頻道右鍵 → 複製頻道 ID。  
  - 填寫格式：純數字字串。

- `DISCORD_ADMIN_RELAY_TOKEN`  
  - 用途：保護 `/api/admin-relay`，後台呼叫時要帶同一個 Bearer Token。  
  - 設置方式：自行產生高強度隨機字串（建議至少 32 字元）。  
  - 填寫格式：隨機字串。

- `DISCORD_BOT_SYNC_TOKEN`  
  - 用途：保護 `/api/sync-user`，網站觸發身份組同步時使用。  
  - 設置方式：自行產生高強度隨機字串。  
  - 填寫格式：隨機字串。  
  - 注意：必須與網站端 `DISCORD_BOT_SYNC_TOKEN` 完全一致。

- `CTRCHK_API_BASE_URL`  
  - 用途：Bot 回查網站會員資料 API 的根網址。  
  - 設置方式：填網站正式網域，例如 `https://ctrchk.com`。  
  - 注意：不要加結尾 `/`。

- `CTRCHK_API_BOT_TOKEN`  
  - 用途：Bot 呼叫網站 `/api/oauth?action=discord-profile` 時的授權 Token。  
  - 設置方式：與網站端 `CTRCHK_API_BOT_TOKEN` 保持一致。  
  - 填寫格式：隨機字串。

### B. Role 映射變數（強烈建議全部填寫）

以下全部都是 Discord 身份組的 **Role ID**（純數字）。  
取得方式：在 Discord 開發者模式下，右鍵對應身份組 → 複製 ID。

- 車手等級：
  - `ROLE_CYCLIST_BEGINNER_ID` → 入門車手
  - `ROLE_CYCLIST_NOVICE_ID` → 初階車手
  - `ROLE_CYCLIST_ADVANCED_ID` → 進階車手
  - `ROLE_CYCLIST_VETERAN_ID` → 資深車手
  - `ROLE_CYCLIST_ELITE_ID` → 精英車手
  - `ROLE_CYCLIST_TOP_ID` → 頂尖車手

- 里程計劃：
  - `ROLE_MILEAGE_BRONZE_ID` → 銅卡
  - `ROLE_MILEAGE_SILVER_ID` → 銀卡
  - `ROLE_MILEAGE_GOLD_ID` → 金卡

- 會員身份：
  - `ROLE_MEMBERSHIP_JUNIOR_ID` → 普通會員（junior）
  - `ROLE_MEMBERSHIP_SENIOR_ID` → 高級會員（senior）
  - `ROLE_MEMBERSHIP_VIP_ID` → VIP 會員（vip）
  - `ROLE_MEMBERSHIP_ADMIN_ID` → 管理員（admin）
  - `ROLE_MEMBERSHIP_SENIOR_ADMIN_ID` → 高級管理員（senior_admin）

> 如有缺漏，Bot 只會同步已配置到的身份組，未配置項目會被跳過。

### C. Bot 運行參數（可選，未填會用預設值）

- `PORT`：Bot API 監聽埠，預設 `8787`。  
- `RELAY_RATE_WINDOW_MS`：限流時間窗（毫秒），預設 `60000`。  
- `RELAY_RATE_LIMIT_MAX`：時間窗內最大請求數，預設 `30`。

## 4.4 設定網站環境變數（Vercel / GCP）

先講結論（對應常見疑問）：

1. 你做的是 Discord Bot，**不需要有一個 bot 前台網站**。  
   `DISCORD_BOT_SYNC_ENDPOINT` 要的是「Bot API 位址」，不是網頁前台。
2. 4.4 不填車手/里程卡 role 是正常的；  
   **同步後自動派發三軌 role** 主要由 Bot 端 4.3(B) 的 `ROLE_*` 映射負責。
3. 4.4 這裡的網站設定重點是：Discord OAuth + 觸發 Bot 同步。

以下變數請設在網站部署環境（Production / Preview 視需要）：

- `DISCORD_CLIENT_ID`  
  - 填甚麼：Discord Developer Portal → **General Information** → **Application ID**。  
  - 格式：純數字字串。  
  - 檢查：必須與 Bot 端 `DISCORD_CLIENT_ID` 一致。

- `DISCORD_CLIENT_SECRET`  
  - 填甚麼：Discord Developer Portal → **OAuth2** → **Client Secret**。  
  - 格式：原始字串（不要加引號）。  
  - 檢查：只放在伺服器環境，不可前端暴露。

- `DISCORD_GUILD_ID`  
  - 填甚麼：目標 Discord 伺服器 ID（右鍵伺服器圖示複製 ID）。  
  - 格式：純數字字串。  
  - 檢查：必須與 Bot 端 `DISCORD_GUILD_ID` 一致。

- `DISCORD_SENIOR_ADMIN_ROLE_ID`（選填）  
  - 用途：網站在 OAuth 流程中，讀取 Discord 既有身份組時，用來判定是否升級網站帳號到 `senior_admin`。  
  - 注意：這組變數是「Discord → 網站帳號等級」判定，不是 Bot 三軌派發的主配置。

- `DISCORD_VIP_ROLE_ID`（選填）  
  - 用途：同上，用於判定網站帳號 `vip`。

- `DISCORD_ADMIN_ROLE_ID`（選填）  
  - 用途：同上，用於判定網站帳號 `admin`。

- `DISCORD_SENIOR_ROLE_ID`（選填）  
  - 用途：同上，用於判定網站帳號 `senior`。

- `DISCORD_BOT_SYNC_ENDPOINT`  
  - 填甚麼：網站呼叫 Bot 同步 API 的**完整 URL**（Bot 後端服務位址）。  
  - 格式：`https://<你的-bot-api-domain>/api/sync-user`  
  - 例子：`https://ctrchk-discord-bot.onrender.com/api/sync-user`  
  - 常見錯誤：  
    - 只填網域（少了 `/api/sync-user`）  
    - 打成網站前台網域而不是 Bot API 網域  
    - 用了 `http://` 導致部署環境被擋

- `DISCORD_BOT_SYNC_TOKEN`  
  - 填甚麼：網站呼叫 Bot 同步 API 的 Bearer Token。  
  - 格式：高強度隨機字串。  
  - 檢查：必須與 Bot 端 `DISCORD_BOT_SYNC_TOKEN` 完全一致。

- `CTRCHK_API_BOT_TOKEN`  
  - 填甚麼：Bot 回查網站資料時使用的授權 Token。  
  - 格式：高強度隨機字串。  
  - 檢查：必須與 Bot 端 `CTRCHK_API_BOT_TOKEN` 完全一致。

> 4.4 是否要填金／銀／銅卡、各級車手 Role？  
> 不需要在 **網站 4.4** 填。三軌（車手等級 / 里程卡 / 會員身份）的 Discord 派發主邏輯在 Bot。  
> 只要 **4.3(B) 的 `ROLE_*` 映射完整**，網站觸發同步後就會由 Bot 自動派發對應 role。

## 4.5 啟動 Bot

```bash
cd discord-bot
npm install
npm run start
```

重點不是「一定要你自己有實體機器」，而是 **Bot 必須有長駐執行環境**。  
這個環境可以是雲端平台，不一定是你本地電腦。

如果你現在已經是「GitHub 提交 → 雲端平台 redeploy → Bot 自動生效」，代表你其實已具備 4.5 需要的條件，只要：

1. Bot 服務在雲端保持運行（不中斷）。  
2. 4.3 的 Bot 環境變數設在該雲端平台。  
3. 4.4 的網站環境變數設在 Vercel（或你用的網站平台）。

## 4.6 Bot 操作方式（啟動後怎樣用）

1. **先確認 Bot 在線**：Discord 成員列表看到 Bot 為在線狀態。  
2. **測試 Slash 指令**：在伺服器任一可用頻道輸入 `/status`。  
3. **驗證網站→Bot 同步**：用測試帳號在網站連結 Discord，確認身份組有更新。  
4. **驗證後台代發（Admin Relay）**：在後台發一則測試公告到指定頻道。  
5. **看 log 排錯**：若失敗，先檢查 Bot 啟動 log（Token、Guild ID、Role 權限、API token 是否一致）。
6. **打健康檢查端點**（Bot API）：
   - `GET /healthz`：看進程在線、uptime、最近 Discord 錯誤
   - `GET /readyz`：看 Discord Client 是否 ready（未 ready 會回 503）

---

## 5) API 對接說明（網站與 Bot 如何互通）

### 5.1 CTRCHK → Bot：觸發同步身份組

- `POST /api/sync-user`
- Header：`Authorization: Bearer <DISCORD_BOT_SYNC_TOKEN>`
- Body：
  ```json
  { "userId": 123, "discordId": "1234567890" }
  ```

用途：網站在用戶連結 Discord 後，呼叫 Bot 更新該用戶身份組。

### 5.2 Bot → CTRCHK：讀取用戶資料

- `GET /api/oauth?action=discord-profile&discord_id=<id>`（或 `user_id`）
- Header：`Authorization: Bearer <CTRCHK_API_BOT_TOKEN>`
- 回傳：會員身份、車手等級、里程卡、里程幣、Discord ID 等

用途：Bot 執行 `/status` 或同步身份組時，拉取最新資料。

### 5.3 Admin Relay（後台代發官方訊息）

- `POST /api/admin-relay`
- Header：`Authorization: Bearer <DISCORD_ADMIN_RELAY_TOKEN>`
- 純文字 Body：
  ```json
  { "channelId": "123", "content": "官方公告內容" }
  ```
- Embed Body：
  ```json
  {
    "channelId": "123",
    "embed": {
      "title": "公告",
      "description": "內容",
      "color": 3066993,
      "footer": "CTRCHK"
    }
  }
  ```

---

## 6) 驗收清單（逐項打勾）

- 新成員入群會收到正式歡迎訊息
- `/status` 可讀到完整狀態（里程卡、里程幣、車手等級、會員身份）
- 網站連結 Discord 後會自動同步三軌身份組
- 後台可指定頻道發純文字或 Embed
- 5/31 前首次連結成功可收到 100 里程幣

---

## 7) 常見錯誤與排查

### 問題 A：Bot 無法派發身份組

優先檢查：

1. Bot 角色是否高於目標身份組  
2. `Manage Roles` 是否已授權  
3. Role ID 是否貼錯（常見：把頻道 ID 當 Role ID）

### 問題 B：網站顯示已連結，但 Discord 沒更新

優先檢查：

1. `DISCORD_BOT_SYNC_ENDPOINT` 是否正確可達  
2. `DISCORD_BOT_SYNC_TOKEN` 網站與 Bot 是否完全一致  
3. Bot 服務是否在線（有沒有異常重啟或停止）
4. 先打 Bot `GET /readyz`，如果是 503 代表 Discord 端未成功連線

### 問題 C：`/status` 回傳空資料或失敗

優先檢查：

1. `CTRCHK_API_BASE_URL` 是否正確  
2. `CTRCHK_API_BOT_TOKEN` 是否有效  
3. `GET /api/oauth?action=discord-profile...` 是否可由 Bot 端成功存取
4. 打 Bot `GET /healthz` 檢查 `CTRCHK_API_BASE_URL` / `CTRCHK_API_BOT_TOKEN` 是否有配置

### 問題 D：Admin Relay 發不出訊息

優先檢查：

1. `DISCORD_ADMIN_RELAY_TOKEN` 是否正確  
2. `channelId` 是否有效且 Bot 對該頻道有發言權限  
3. 發送內容是否超出 Discord 限制（過長或格式錯誤）

---

## 8) 安全與維運建議（建議遵守）

- 所有 Token 一律放在環境變數，不要寫入程式碼或提交到 Git  
- 若 Token 洩漏，立即重置並更新網站與 Bot 兩邊設定  
- 任何「同步失敗」問題先看 Bot log，再看網站 API log  
- 每次調整身份組規則後，建議用測試帳號做完整驗收

---

## 9) 最短上線路徑（快速版）

若你只想先上線最核心功能，請最少完成以下項目：

1. 建立 Bot 並正確設定角色順位  
2. 設定 `discord-bot/.env` 的核心變數  
3. 設定網站端 Discord 相關環境變數  
4. 啟動 Bot 並確保 `/api/sync-user` 可被網站呼叫  
5. 用測試帳號完成「連結 Discord → 同步身份組 → `/status` 驗證」

完成以上 5 步後，再補完歡迎訊息與 Admin Relay。
