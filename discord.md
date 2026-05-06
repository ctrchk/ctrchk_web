# CTRC × Discord 整合設置指南

本指南教你如何在 CTRC 系統中啟用 Discord 整合，讓用戶能以 Discord 帳號連結 CTRC 帳戶，並自動同步 Discord 伺服器身份組至 CTRC 會員等級。

---

## 目錄

1. [功能說明](#1-功能說明)
2. [建立 Discord 應用程式](#2-建立-discord-應用程式)
3. [設置 Redirect URI](#3-設置-redirect-uri)
4. [設置環境變數](#4-設置環境變數)
5. [Discord 身份組與 CTRC 等級對應](#5-discord-身份組與-ctrc-等級對應)
6. [取得 Discord 身份組 ID](#6-取得-discord-身份組-id)
7. [用戶操作流程](#7-用戶操作流程)
8. [API 說明](#8-api-說明)
9. [常見問題](#9-常見問題)

---

## 1. 功能說明

| 功能 | 說明 |
|------|------|
| 連結 Discord 帳號 | 用戶在 CTRC 儀表板點選「連結 Discord」，透過 OAuth2 授權後完成連結 |
| 同步身份組 | 系統讀取用戶在 CTRC Discord 伺服器的身份組，自動升級對應的 CTRC 會員等級 |
| 只升不降 | 等級只會因 Discord 身份組而**升級**，不會因為沒有對應身份組而降級 |
| 重新同步 | 用戶可隨時在儀表板點「重新同步身份組」，重新授權並更新等級 |
| 解除連結 | 用戶可解除 Discord 連結（不影響已取得的 CTRC 等級） |

### 等級對應邏輯

```
Discord 身份組                 →  CTRC 等級
─────────────────────────────────────────────
DISCORD_ADMIN_ROLE_ID 身份組   →  admin（管理員）
DISCORD_SENIOR_ROLE_ID 身份組  →  senior（高級會員）
以上皆無 / 不在伺服器           →  維持現有等級（不降級）
```

---

## 2. 建立 Discord 應用程式

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點選右上角「**New Application**」
3. 輸入應用程式名稱（例如 `CTRC HK`），點選「Create」
4. 在左側選單選「**OAuth2**」→「**General**」
5. 記下以下資訊（下一步使用）：
   - **Client ID**（公開）
   - **Client Secret**（點選「Reset Secret」產生，請妥善保存）

---

## 3. 設置 Redirect URI

在 Discord Developer Portal 的「OAuth2 → Redirects」中加入以下網址：

```
https://ctrchk.com/discord-callback
```

> ⚠️ 本地開發時請另外加入：`http://localhost:3000/discord-callback`（或你使用的本地端口）

---

## 4. 設置環境變數

在 **Vercel 專案設定 → Environment Variables** 中加入以下變數：

### 必填

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `DISCORD_CLIENT_ID` | Discord 應用程式 Client ID | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | Discord 應用程式 Client Secret | `AbCdEfGhIjKlMnOpQrSt` |

### 選填（身份組同步）

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `DISCORD_GUILD_ID` | 你的 Discord 伺服器 ID（用於讀取身份組） | `9876543210987654321` |
| `DISCORD_ADMIN_ROLE_ID` | 對應 CTRC **管理員**的 Discord 身份組 ID | `1111111111111111111` |
| `DISCORD_SENIOR_ROLE_ID` | 對應 CTRC **高級會員**的 Discord 身份組 ID | `2222222222222222222` |

> 💡 若不設置 `DISCORD_GUILD_ID`，系統仍可連結 Discord 帳號，但無法同步身份組（等級維持不變）。  
> 若不設置 `DISCORD_ADMIN_ROLE_ID` / `DISCORD_SENIOR_ROLE_ID`，即使有 Guild ID，也不會升級任何等級。

---

## 5. Discord 身份組與 CTRC 等級對應

在你的 Discord 伺服器中，建立以下身份組（名稱可自定，重要的是 ID）：

| 建議身份組名稱 | 對應 CTRC 等級 | 環境變數 |
|--------------|--------------|---------|
| `CTRC Admin` | 管理員 (admin) | `DISCORD_ADMIN_ROLE_ID` |
| `CTRC Senior` / `高級會員` | 高級會員 (senior) | `DISCORD_SENIOR_ROLE_ID` |

### 建立身份組步驟

1. 在 Discord 伺服器點選「**伺服器設定**」→「**身份組**」
2. 點「**建立身份組**」，輸入名稱
3. 設置好後，複製身份組 ID（見下節）

---

## 6. 取得 Discord 身份組 ID

1. 在 Discord 中開啟「**用戶設定**」→「**進階**」→ 開啟「**開發者模式**」
2. 回到你的伺服器，在「**伺服器設定**」→「**身份組**」中右鍵點選目標身份組
3. 選「**複製身份組 ID**」

### 取得伺服器 ID

1. 右鍵點選左側欄的伺服器圖示
2. 選「**複製伺服器 ID**」

---

## 7. 用戶操作流程

### 連結 Discord（用戶視角）

1. 登入 CTRC 帳戶
2. 前往「**儀表板**」
3. 找到「**Discord 連結**」卡片，點選「**🔗 連結 Discord**」
4. 瀏覽器跳轉至 Discord 授權頁面
5. 確認授權（需允許 `identify`、`email`、`guilds.members.read` 範圍）
6. 自動跳回 `/discord-callback` 頁面，顯示連結結果及同步後的等級
7. 跳回儀表板

### 重新同步身份組

- 如果 Discord 伺服器身份組有變動，在儀表板點「**🔄 重新同步身份組**」重新授權即可

### 解除連結

- 在儀表板點「**解除連結**」即可移除 Discord 連結（CTRC 等級不受影響）

---

## 8. API 說明

所有端點均位於 `/api/discord-auth`。

### GET `/api/discord-auth?action=url`

取得 Discord OAuth2 授權 URL。

- **需要**：`Authorization: Bearer <accessToken>` 標頭
- **回應**：`{ "url": "https://discord.com/oauth2/authorize?..." }`

### POST `/api/discord-auth?action=callback`

用授權碼完成連結並同步身份組。

- **請求體**：`{ "code": "...", "state": "..." }`
- **回應**：
  ```json
  {
    "message": "Discord 帳號連結成功",
    "discord_username": "username",
    "discord_global_name": "顯示名稱",
    "discord_avatar": "https://cdn.discordapp.com/...",
    "role_synced": "senior",
    "in_guild": true
  }
  ```

### GET `/api/discord-auth?action=status`

取得帳戶的 Discord 連結狀態。

- **需要**：`Authorization: Bearer <accessToken>` 標頭
- **回應**：`{ "linked": true, "discord_id": "..." }`

### POST `/api/discord-auth?action=unlink`

解除 Discord 連結。

- **需要**：`Authorization: Bearer <accessToken>` 標頭
- **回應**：`{ "message": "Discord 帳號已解除連結" }`

---

## 9. 常見問題

### Q：用戶不在 Discord 伺服器，連結後等級會變嗎？

不會。若用戶未加入指定的 Discord 伺服器，系統無法讀取身份組，等級維持不變。用戶加入伺服器並取得相應身份組後，重新點「重新同步身份組」即可升級。

### Q：Discord 身份組被移除後，CTRC 等級會被降級嗎？

不會。系統採用「**只升不降**」原則，等級一旦升級，不會因 Discord 身份組被移除而自動降級。如需手動調整，請管理員在後台修改。

### Q：一個 Discord 帳號可以連結多個 CTRC 帳戶嗎？

不可以。每個 Discord 帳號只能連結一個 CTRC 帳戶。若嘗試連結已被綁定的 Discord 帳號，系統會顯示錯誤提示。

### Q：用戶解除連結後，能重新連結同一個 Discord 帳號嗎？

可以。解除連結後，Discord ID 會從資料庫移除，用戶可以重新透過授權流程連結同一個 Discord 帳號。

### Q：Discord 整合卡片不顯示怎麼辦？

請確認 `DISCORD_CLIENT_ID` 環境變數已正確設置。若未設置，儀表板的 Discord 卡片會自動隱藏。

### Q：本地開發如何測試？

1. 在 Discord Developer Portal 的 Redirect URIs 加入 `http://localhost:3000/discord-callback`（或你的本地端口）
2. 設置本地環境變數（`.env.local`）：
   ```
   DISCORD_CLIENT_ID=你的ClientID
   DISCORD_CLIENT_SECRET=你的ClientSecret
   DISCORD_GUILD_ID=你的伺服器ID
   DISCORD_SENIOR_ROLE_ID=身份組ID
   BASE_URL=http://localhost:3000
   ```
3. 以 `vercel dev` 啟動本地開發伺服器

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `api/discord-auth.js` | Discord OAuth2 後端 API |
| `discord-callback.html` | OAuth2 回調頁面（處理授權碼並顯示結果） |
| `dashboard.html` | 儀表板（含 Discord 連結卡片） |
| `api/_db.js` | 資料庫遷移（含 `discord_id` 欄位） |
