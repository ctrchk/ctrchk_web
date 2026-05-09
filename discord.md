# CTRCHK Discord 完整教學（網站＋Bot 一次打通）

本文件是 CTRCHK Discord 整合的完整操作手冊，目標是讓你由零開始完成：

1. 建立 Discord 應用與 Bot  
2. 建立並對應 CTRCHK 三軌身份組  
3. 設定網站與 Bot 雙方環境變數  
4. 啟動 Bot 並與網站 API 互通  
5. 驗收所有功能（歡迎訊息、訪客自動派發、`/status`、身份組同步、Ticket、Admin Relay）

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
- 新成員入群自動獲得「訪客」身份組
- 用戶在網站連結 Discord 後，自動同步身份組
- 在 `#客服` 放置客服面板按鈕，點擊可開 Ticket（每人同時僅 1 張）
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
   - View Channels
   - Send Messages
   - Manage Messages（用於編輯及刪除 Bot 自己的消息）
   - Read Message History（用於後台載入頻道消息列表）
   - Embed Links（如需發送 Embed 消息）
   - Use Slash Commands
4. 把 Bot 邀請進你的 Discord 伺服器。  
5. 在伺服器身份組設定中，將 **Bot 角色放在所有 CTRCHK 目標身份組之上**。  
   - 否則 Bot 無法派發或更新身份組（最常見錯誤）。

> **遇到「Missing Permissions」錯誤？**  
> 這是 Discord API 的頻道級別權限錯誤，通常原因如下：  
> - Bot 角色沒有目標頻道的 **Send Messages** 或 **View Channel** 權限  
> - 目標頻道設置了僅限特定身份組發言的覆蓋規則，Bot 角色未被包含  
> - 如為公告頻道（Announcement Channel），Bot 還需 **Send Messages in Threads** 權限  
> 
> 解決方法：前往 Discord → 頻道設定 → 權限，確認 Bot 的角色（或 @everyone）有足夠權限，或為 Bot 新增特定的頻道覆蓋規則。

## 4.2 開啟開發者模式並收集所有 ID

1. 在 Discord 用戶設定啟用「開發者模式」。  
2. 右鍵每個身份組，複製 Role ID。  
3. 右鍵伺服器圖示，複製 Guild ID。  
4. 選一個歡迎頻道，複製 Channel ID（新成員歡迎用途）。
5. 複製「訪客」身份組 Role ID（或確保名稱就是 `訪客`）。
6. 複製 Ticket 需要的 ID：
   - `#客服` 頻道 ID（放開單按鈕）
   - Ticket 分類（Category）ID（選填）
   - 高級管理員身份組 Role ID

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

- `DISCORD_DEFAULT_MEMBER_ROLE_ID`（建議填）  
  - 用途：新成員入群時自動派發預設身份組（例如「訪客」）。  
  - 去哪裡拿：訪客身份組右鍵 → 複製 Role ID。  
  - 注意：若不填 ID，Bot 會用 `DISCORD_DEFAULT_MEMBER_ROLE_NAME`（預設 `訪客`）找身份組。

- `DISCORD_DEFAULT_MEMBER_ROLE_NAME`（選填）  
  - 用途：預設身份組名稱後備值。  
  - 建議：維持 `訪客`，除非你在伺服器使用其他名稱。

- `DISCORD_TICKET_CHANNEL_ID`  
  - 用途：客服面板消息投放頻道（建議設定為 `#客服`）。  
  - 去哪裡拿：`#客服` 頻道右鍵 → 複製頻道 ID。

- `DISCORD_TICKET_ADMIN_ROLE_ID`（建議填）  
  - 用途：可檢視及處理 Ticket 的管理身份組。  
  - 去哪裡拿：高級管理員身份組右鍵 → 複製 Role ID。  
  - 注意：若不填 ID，Bot 會用 `DISCORD_TICKET_ADMIN_ROLE_NAME`（預設 `CTRC 會員｜高級管理員`）找身份組。

- `DISCORD_TICKET_ADMIN_ROLE_NAME`（選填）  
  - 用途：Ticket 管理身份組名稱後備值。  
  - 建議：維持 `CTRC 會員｜高級管理員` 或改成你的實際名稱。

- `DISCORD_TICKET_CATEGORY_ID`（選填）  
  - 用途：新 Ticket 建立時放入指定分類。  
  - 不填：Ticket 會建立在伺服器根層級頻道列表。

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
4. **驗證 Ticket**：在 `#客服` 按按鈕開單，確認同一用戶不能同時開第 2 張，並可由用戶或高級管理員關單。  
5. **驗證後台代發（Admin Relay）**：在後台發一則測試公告到指定頻道。  
6. **看 log 排錯**：若失敗，先檢查 Bot 啟動 log（Token、Guild ID、Role 權限、API token 是否一致）。
7. **打健康檢查端點**（Bot API）：
   - `GET /healthz`：看進程在線、uptime、最近 Discord 錯誤
   - `GET /readyz`：看 Discord Client 是否 ready（未 ready 會回 503）

## 4.7 超詳細部署教學（一步一步，照做即可）

> 目標：把 Bot 部署到可長駐的平台（示範用 Render），再把網站（Vercel）接上 Bot 的同步 API。  
> 你如果不是用 Render，也可照同一邏輯搬到 Railway/Fly.io/VM。

### 第 0 步：先準備 3 組資料表（先整理，部署時不會手忙腳亂）

先開一個純文字檔（不要上傳 Git），把以下內容先填好：

1. **Discord 基本資料**
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `DISCORD_WELCOME_CHANNEL_ID`
   - `DISCORD_DEFAULT_MEMBER_ROLE_ID`（或保留名稱後備）
   - `DISCORD_TICKET_CHANNEL_ID`
   - `DISCORD_TICKET_CATEGORY_ID`（選填）
   - `DISCORD_TICKET_ADMIN_ROLE_ID`
2. **Bot 安全 Token（自行產生）**
   - `DISCORD_ADMIN_RELAY_TOKEN`
   - `DISCORD_BOT_SYNC_TOKEN`
   - `CTRCHK_API_BOT_TOKEN`
3. **Role ID 對照表**
   - 車手 6 組、里程卡 3 組、會員 5 組（共 14 組）

> 建議你先全部收齊再進下一步，成功率最高。

### 第 1 步：確認 Discord Bot 權限與角色順位

1. 到 Discord 伺服器設定 → 身份組（Roles）。
2. 找到 Bot 身份組（通常是 Bot 名稱）。
3. 把 Bot 身份組拖到所有 `CTRC ...` 目標身份組上方。
4. 確認 Bot 有 `Manage Roles`、`Send Messages` 權限。
5. 若你要用 `/status`，確認 `Use Slash Commands` 可用。

> 這一步錯，後面全部都會「看似成功、其實不同步」。

### 第 2 步：在 Render 建立 Bot 服務

1. 登入 Render。
2. 按 **New +** → **Web Service**。
3. 連接 GitHub，選 repository：`ctrchk/ctrchk_web`。
4. 進入服務設定頁，填：
   - **Name**：例如 `ctrchk-discord-bot`
   - **Root Directory**：`discord-bot`
   - **Environment**：`Node`
   - **Build Command**：`npm install`
   - **Start Command**：`npm run start`
5. Region 可先用離你主要用戶近的位置（例如 Singapore）。
6. 方案先用可長駐的最低方案即可（重點是常駐，不是 serverless）。
7. 先不要按 Deploy，先進環境變數（下一步）。

### 第 3 步：把 Bot 環境變數填進 Render（最關鍵）

在 Render 服務的 **Environment**，逐個新增以下 key/value：

#### 3A. 必填（沒有就不能正常運作）

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_WELCOME_CHANNEL_ID`
- `DISCORD_DEFAULT_MEMBER_ROLE_ID`（或 `DISCORD_DEFAULT_MEMBER_ROLE_NAME`）
- `DISCORD_TICKET_CHANNEL_ID`
- `DISCORD_TICKET_ADMIN_ROLE_ID`（或 `DISCORD_TICKET_ADMIN_ROLE_NAME`）
- `DISCORD_ADMIN_RELAY_TOKEN`
- `DISCORD_BOT_SYNC_TOKEN`
- `CTRCHK_API_BASE_URL`（例：`https://ctrchk.com`）
- `CTRCHK_API_BOT_TOKEN`

#### 3B. 強烈建議全填（角色同步核心）

- `ROLE_CYCLIST_BEGINNER_ID`
- `ROLE_CYCLIST_NOVICE_ID`
- `ROLE_CYCLIST_ADVANCED_ID`
- `ROLE_CYCLIST_VETERAN_ID`
- `ROLE_CYCLIST_ELITE_ID`
- `ROLE_CYCLIST_TOP_ID`
- `ROLE_MILEAGE_BRONZE_ID`
- `ROLE_MILEAGE_SILVER_ID`
- `ROLE_MILEAGE_GOLD_ID`
- `ROLE_MEMBERSHIP_JUNIOR_ID`
- `ROLE_MEMBERSHIP_SENIOR_ID`
- `ROLE_MEMBERSHIP_VIP_ID`
- `ROLE_MEMBERSHIP_ADMIN_ID`
- `ROLE_MEMBERSHIP_SENIOR_ADMIN_ID`

#### 3C. 可選（先用預設也可）

- `PORT`（可不填，平台會注入；本專案預設 `8787`）
- `RELAY_RATE_WINDOW_MS`（預設 `60000`）
- `RELAY_RATE_LIMIT_MAX`（預設 `30`）
- `DISCORD_TICKET_CATEGORY_ID`（選填；不填則 Ticket 不會自動歸類）

### 第 4 步：首次部署 Render

1. 按 **Create Web Service / Deploy**。
2. 等待 Build 完成。
3. 進入 Logs 檢查以下關鍵字：
   - `listening on`
   - `Logged in as`
   - `/status guild command registered`（或 global registered）
4. 如果出現 `Login failed`：
   - 先重設 `DISCORD_BOT_TOKEN` 再貼回 Render。
   - 確認 `DISCORD_CLIENT_ID`、`DISCORD_GUILD_ID` 沒貼錯。
5. 如果出現 `Shard error: Used disallowed intents` 或 `code 4014`：
   - 到 Discord Developer Portal → 你的 App → **Bot** → **Privileged Gateway Intents**。
   - 開啟 **SERVER MEMBERS INTENT**（對應程式使用的 `GuildMembers` intent）。
   - 按 **Save Changes** 後回 Render 重新部署（Deploy latest commit 或手動重啟）。
   - 若仍失敗，重新貼上 `DISCORD_BOT_TOKEN` 再部署，並確認你開的是「目前 token 對應的同一個 App」。

### 第 5 步：部署後先驗 Bot 健康狀態

假設你的 Render 網域是 `https://ctrchk-discord-bot.onrender.com`：

1. 瀏覽器開：`https://ctrchk-discord-bot.onrender.com/healthz`
   - 預期 `ok: true`
2. 再開：`https://ctrchk-discord-bot.onrender.com/readyz`
   - 預期 `ok: true`
   - 若 `503`，代表 Discord 還未 ready（看 logs）

### 第 6 步：把網站（Vercel）接到 Bot API

到 Vercel 專案 → Settings → Environment Variables，填／更新：

1. `DISCORD_BOT_SYNC_ENDPOINT`
   - 值：`https://<你的-render-domain>/api/sync-user`
   - 例：`https://ctrchk-discord-bot.onrender.com/api/sync-user`
2. `DISCORD_BOT_SYNC_TOKEN`
   - 值必須與 Render 裡的 `DISCORD_BOT_SYNC_TOKEN` 完全一致
3. `CTRCHK_API_BOT_TOKEN`
   - 值必須與 Render 裡的 `CTRCHK_API_BOT_TOKEN` 完全一致
4. `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_GUILD_ID`
   - 確保與 Discord App / Bot 設定一致

> 填完後要 **Redeploy Vercel**，否則新變數不會生效。

### 第 7 步：做「實戰驗收」而不是只看部署成功

1. 用測試 Discord 帳號加入伺服器，確認歡迎訊息正常。
2. 確認新成員同時自動拿到「訪客」身份組。
3. 在 Discord 輸入 `/status`：
   - 預期看到里程卡、里程幣、車手等級、會員身份。
4. 到 `#客服` 按按鈕建立 Ticket，確認每人同時只能有 1 張，並可關閉。
5. 到網站用測試帳號做「連結 Discord」。
6. 連結完成後，回 Discord 看身份組是否更新。
7. 後台發一則 Admin Relay 公告，確認 Bot 可代發。

### 第 8 步：失敗時按這個順序排查（不要亂改）

1. 先打 Bot `GET /readyz`（先確定 Discord 連線狀態）。
2. 再看 Render logs（登入失敗？權限？token？）。
3. 再檢查 Vercel 的 `DISCORD_BOT_SYNC_ENDPOINT` 是否完整含 `/api/sync-user`。
4. 比對兩邊 token 是否「完全一致」：
   - `DISCORD_BOT_SYNC_TOKEN`
   - `CTRCHK_API_BOT_TOKEN`
5. 最後檢查 Discord 角色順位是否又被改動。

### 第 9 步：之後每次更新 Bot 的標準流程

1. push 到 GitHub（`discord-bot` 有改動）。
2. Render 自動 redeploy（或手動 Deploy latest commit）。
3. 部署完成後，先驗 `healthz` / `readyz`。
4. 再用 `/status` + 網站連結流程做一次快驗。
5. 若改了 token 或 endpoint，記得同步更新 Vercel 並 redeploy。

### 第 10 步：你可以直接照抄的最短部署清單

1. 建 Discord App + Bot  
2. 設定 Bot 權限與角色順位  
3. 收集所有 ID + 產生 3 個安全 token  
4. Render 建 Web Service（Root Directory=`discord-bot`）  
5. Render 填完整環境變數  
6. Deploy 並檢查 logs  
7. 檢查 `/healthz`、`/readyz`  
8. Vercel 設 `DISCORD_BOT_SYNC_ENDPOINT` 與同步 token  
9. Redeploy Vercel  
10. 驗收：歡迎訊息、`/status`、身份組同步、Admin Relay

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
- 新成員入群會自動獲得「訪客」身份組
- `/status` 可讀到完整狀態（里程卡、里程幣、車手等級、會員身份）
- 網站連結 Discord 後會自動同步三軌身份組
- `#客服` 已有 Ticket 面板按鈕，且每人同時僅可開 1 張 Ticket
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
5. 看網站 logs 是否有：
   - `[oauth] Discord bot sync failed: ...`
   - `[getHistory] Discord bot sync failed: ...`
   - `[admin-users] Discord bot sync failed: ...`
   若出現，先按狀態碼排查：401（token 不一致）、404（endpoint 錯）、500（Bot 端錯誤）

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

### 問題 E：Render logs 出現 `Used disallowed intents`（`code 4014`）

這代表 Bot 申請了未被允許的 Gateway Intent。  
本專案會使用 `GuildMembers`，因此必須開啟對應權限。

優先檢查：

1. Discord Developer Portal → App → **Bot** → **Privileged Gateway Intents**：
   - 開啟 **SERVER MEMBERS INTENT**
2. 儲存後回 Render 重新部署
3. 若仍報 4014：
    - 重新貼上 `DISCORD_BOT_TOKEN` 後再部署
    - 確認你調整的是與目前 `DISCORD_BOT_TOKEN` 同一個 Discord App

### 問題 F：Ticket 沒出現在 `#客服` 或按鈕開單失敗

優先檢查：

1. `DISCORD_TICKET_CHANNEL_ID` 是否正確且 Bot 對該頻道有讀寫權限  
2. `DISCORD_TICKET_ADMIN_ROLE_ID`（或 `DISCORD_TICKET_ADMIN_ROLE_NAME`）是否能正確對到身份組  
3. Bot 是否有 `Manage Channels` 權限（建立/刪除 Ticket 頻道需要）  
4. 如有設定 `DISCORD_TICKET_CATEGORY_ID`，確認該分類允許 Bot 建立子頻道

### 問題 G：Bot 沒法 24 小時上線

優先檢查：

1. 你使用的方案是否為「可長駐」方案（免費休眠方案會離線）  
2. 平台健康檢查是否設為 `GET /healthz`（存活）與 `GET /readyz`（Discord 連線狀態）  
3. 平台是否因記憶體/重啟策略導致循環重啟（先看部署平台 logs）

> 補充：若 Bot 因平台休眠而離線，網站端觸發 `/api/sync-user` 會失敗，表現就是「網站顯示已連結 Discord，但 Discord 身分組不更新」。

### 問題 H：環境變數都齊，但身分組仍不同步

請用以下 5 步快速定位（按順序）：

1. 打開 `https://<你的-bot-domain>/healthz`  
   - 若無法連線：先處理平台離線／休眠問題。
2. 打開 `https://<你的-bot-domain>/readyz`  
   - 若回 `503`：代表 Discord Client 未 ready（看 Bot logs）。
3. 檢查網站 `DISCORD_BOT_SYNC_ENDPOINT`  
   - 必須是完整 `https://<bot-domain>/api/sync-user`，不能只有網域。
4. 核對兩邊 token  
   - `DISCORD_BOT_SYNC_TOKEN`（網站與 Bot 必須完全一致）  
   - `CTRCHK_API_BOT_TOKEN`（網站與 Bot 必須完全一致）
5. 檢查 Discord 權限與角色順位  
   - Bot 角色需高於所有目標身分組，且有 `Manage Roles`。

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

---

## 10) 換平台完整教學（Render 免費休眠 → Railway 常駐）

> 適用場景：你目前平台會休眠，導致 Bot 不是 24 小時在線，進而令身份組同步間歇失效。  
> 目標：把 Bot 遷移到 Railway（或任何可常駐方案），網站仍放 Vercel。

### 第 0 步：先確認是否真的需要搬

先做兩個檢查：

1. 在 Bot 離線時打 `https://<目前-bot-domain>/healthz`  
   - 若逾時/連不上：高機率是平台休眠或服務停機。
2. 看網站 logs 是否出現：  
   - `[oauth] Discord bot sync failed: ...`  
   - `[getHistory] Discord bot sync failed: ...`  
   - `[admin-users] Discord bot sync failed: ...`

若兩者都符合，建議直接搬平台，不要只反覆重部署。

### 第 1 步：在 Railway 建立新服務

1. 登入 Railway。  
2. 建立新 Project。  
3. 選「Deploy from GitHub Repo」。  
4. 選 `ctrchk/ctrchk_web`。  
5. 在服務設定指定：
   - **Root Directory**：`discord-bot`
   - **Start Command**：`npm run start`
6. 確認服務型態為長駐 Web Service（非一次性 Job）。

### 第 2 步：把 Bot 環境變數完整搬過去

在 Railway 逐一新增以下變數（與現有 Bot 一致）：

1. 核心：  
   - `DISCORD_BOT_TOKEN`  
   - `DISCORD_CLIENT_ID`  
   - `DISCORD_GUILD_ID`  
   - `DISCORD_WELCOME_CHANNEL_ID`  
   - `DISCORD_DEFAULT_MEMBER_ROLE_ID`（或名稱後備）  
   - `DISCORD_TICKET_CHANNEL_ID`  
   - `DISCORD_TICKET_ADMIN_ROLE_ID`（或名稱後備）  
   - `DISCORD_ADMIN_RELAY_TOKEN`  
   - `DISCORD_BOT_SYNC_TOKEN`  
   - `CTRCHK_API_BASE_URL`  
   - `CTRCHK_API_BOT_TOKEN`
2. 三軌 Role 映射（建議全填）：  
   - `ROLE_CYCLIST_*`  
   - `ROLE_MILEAGE_*`  
   - `ROLE_MEMBERSHIP_*`
3. 可選：  
   - `PORT`  
   - `RELAY_RATE_WINDOW_MS`  
   - `RELAY_RATE_LIMIT_MAX`  
   - `DISCORD_TICKET_CATEGORY_ID`

### 第 3 步：部署並先驗 Bot 狀態

1. 在 Railway 觸發 Deploy。  
2. 等待 logs 出現：
   - `listening on`  
   - `Logged in as`  
3. 打開：
   - `https://<railway-domain>/healthz`（應回 `ok: true`）  
   - `https://<railway-domain>/readyz`（應回 `ok: true`）

若 `readyz` 仍是 `503`，先看 Discord Token / Intent / 權限，不要先改網站端。

### 第 4 步：切換網站（Vercel）到新 Bot 網域

在 Vercel 更新以下變數：

1. `DISCORD_BOT_SYNC_ENDPOINT`  
   - 改成：`https://<railway-domain>/api/sync-user`
2. `DISCORD_BOT_SYNC_TOKEN`  
   - 必須與 Railway 的值完全一致
3. `CTRCHK_API_BOT_TOKEN`  
   - 必須與 Railway 的值完全一致

更新後 **Redeploy Vercel**。

### 第 5 步：做遷移驗收（必做）

1. Discord 測 `/status` 是否正常。  
2. 網站用測試帳號重新「連結 Discord」。  
3. 確認 Discord 三軌身分組有更新。  
4. 測試 Admin Relay 能否正常發文。  
5. 測試 Ticket 建立與關閉流程。

### 第 6 步：灰度期與回滾策略（建議）

1. 新平台穩定前，舊平台先保留 24 小時。  
2. 若新平台異常，只需把 Vercel `DISCORD_BOT_SYNC_ENDPOINT` 改回舊網域並 redeploy。  
3. 確認新平台連續穩定後，再下線舊服務。
