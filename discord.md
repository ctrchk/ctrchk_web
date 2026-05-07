# CTRCHK Discord 開發與部署指南

本文件為 CTRCHK Discord Bot 與網站 Discord 整合的唯一開發指引。  
所有文字統一使用香港術語：**車手、路線**（嚴禁使用「騎手、線路」）。

---

## 1) 功能總覽

- Discord 新成員自動歡迎與引導
- 網站連結 Discord 後自動同步身份組
- 管理員儀表盤透過 API 由 Bot 官方發話（Admin Relay）
- `/status` 指令顯示：
  - 里程卡類別
  - 里程幣餘額
  - 車手等級
  - 會員身份
- 限時活動：即日起至 **5/31**，首次成功連結 Discord 送 **100 里程幣**

---

## 2) 三軌體系定義

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

## 3) Discord 身份組對應表（必建）

> 下表為建議名稱，實際以 Role ID 對應為準。

### 3.1 車手等級 → Discord 身份組

- 入門車手 → `CTRC 車手｜入門`
- 初階車手 → `CTRC 車手｜初階`
- 進階車手 → `CTRC 車手｜進階`
- 資深車手 → `CTRC 車手｜資深`
- 精英車手 → `CTRC 車手｜精英`
- 頂尖車手 → `CTRC 車手｜頂尖`

### 3.2 里程計劃 → Discord 身份組

- 銅卡 → `CTRC 里程卡｜銅卡`
- 銀卡 → `CTRC 里程卡｜銀卡`
- 金卡 → `CTRC 里程卡｜金卡`

### 3.3 會員身份 → Discord 身份組

- 普通會員 → `CTRC 會員｜普通`
- 高級會員 → `CTRC 會員｜高級`
- VIP 會員 → `CTRC 會員｜VIP`
- 管理員 → `CTRC 會員｜管理員`
- 高級管理員 → `CTRC 會員｜高級管理員`

---

## 4) 你需要操作的步驟（完整教學）

## 4.1 建立 Discord App 與 Bot

1. 到 Discord Developer Portal 建立應用程式。
2. 在 Bot 頁面建立 Bot，開啟必要權限（Manage Roles、Send Messages、Use Slash Commands）。
3. 把 Bot 邀請進伺服器，並把 Bot 角色放在所有 CTRCHK 管理身份組之上（否則無法派發身份組）。

### 4.2 建立身份組並複製 ID

1. 在伺服器設定 > 身份組，建立第 3 章列出的身份組。
2. 開啟 Discord 開發者模式。
3. 右鍵每個身份組，複製 Role ID。
4. 右鍵伺服器圖示，複製 Guild ID。
5. 準備歡迎頻道 ID（新成員歡迎用）。

### 4.3 設定 Bot 環境變數（`discord-bot/.env`）

必要項目：

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_WELCOME_CHANNEL_ID`
- `DISCORD_ADMIN_RELAY_TOKEN`
- `DISCORD_BOT_SYNC_TOKEN`
- `CTRCHK_API_BASE_URL`
- `CTRCHK_API_BOT_TOKEN`

身份組 ID（全部建議填）：

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

### 4.4 設定網站環境變數（Vercel / GCP）

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_GUILD_ID`
- `DISCORD_SENIOR_ADMIN_ROLE_ID`
- `DISCORD_VIP_ROLE_ID`
- `DISCORD_ADMIN_ROLE_ID`
- `DISCORD_SENIOR_ROLE_ID`
- `DISCORD_BOT_SYNC_ENDPOINT`（例：`https://bot.example.com/api/sync-user`）
- `DISCORD_BOT_SYNC_TOKEN`（需與 Bot 端一致）

### 4.5 啟動 Bot（iPad + Google Cloud Shell）

```bash
cd discord-bot
npm install
npm run start
```

建議用 PM2 / Cloud Run 長駐執行，避免中斷。

---

## 5) API 說明（Bot 對接）

### 5.1 CTRCHK 提供給 Bot：讀取用戶資料

- `GET /api/oauth?action=discord-profile&discord_id=<id>`（或 `user_id`）
- Header：`Authorization: Bearer <CTRCHK_API_BOT_TOKEN>`
- 回傳：會員身份、車手等級、里程卡、里程幣、Discord ID 等

### 5.2 Bot 提供給 CTRCHK：同步身份組

- `POST /api/sync-user`
- Header：`Authorization: Bearer <DISCORD_BOT_SYNC_TOKEN>`
- Body：`{ "userId": 123, "discordId": "1234567890" }`

### 5.3 Admin Relay（後台發話）

- `POST /api/admin-relay`
- Header：`Authorization: Bearer <DISCORD_ADMIN_RELAY_TOKEN>`
- Body（純文字）：
  ```json
  { "channelId": "123", "content": "官方公告內容" }
  ```
- Body（Embed）：
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

## 6) 驗收清單

- 新成員入群會收到正式歡迎訊息
- `/status` 可讀到完整狀態
- 網站連結 Discord 後會自動同步三軌身份組
- 後台可指定頻道發純文字/Embed
- 5/31 前首次連結成功可收到 100 里程幣
