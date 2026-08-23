# Resend 與 Webhook 郵件接收設置指南 (CTRCHK MAIL)

本指南提供逐步指示，說明如何為 `@ctrchk.com` 正確設置 **Resend API**、**DNS 記錄**、**Cloudflare Email Routing** 及 **Inbound Webhook**，解決無法收到外部郵件或郵件發送報錯的問題。

---

## 核心原理說明

CTRCHK Mail 的電郵收發架構如下：

1. **發送郵件 (Outbound)**：
   - 使用者在 `email-inbox.html` 點擊「發送」。
   - 後端 `/api/email?action=send` 調用 **Resend API (`https://api.resend.com/emails`)** 發出郵件。
   - 要求：Resend 帳戶中必須已新增並驗證 `ctrchk.com` 網域，且 Vercel 已設置 `RESEND_API_KEY`。

2. **接收郵件 (Inbound)**：
   - 外部寄件者發送郵件給 `anyname@ctrchk.com`。
   - **方式 A (Cloudflare Email Routing + Worker)**：MX 記錄指向 Cloudflare，Cloudflare Email Worker 將郵件解析後 POST 到 `https://ctrchk.com/api/email?action=webhook-incoming`。
   - **方式 B (Resend Inbound Webhook)**：Resend 收到郵件後通過 Webhook 將 JSON 事件 POST 到 `https://ctrchk.com/api/email?action=webhook-incoming`。

---

## 步驟 1：Resend 網域與 API 密鑰設置 (發送郵件)

1. **登入 Resend 控制台**：前往 [https://resend.com](https://resend.com) 並登入帳戶。
2. **新增網域 (Domains)**：
   - 點擊左側選單 **Domains** -> **Add Domain**。
   - 輸入網域：`ctrchk.com`（Region 選擇靠近香港的平臺，如 Singapore 或 US East）。
3. **設置 DNS 驗證記錄**：
   - Resend 會提供 **DKIM (TXT)**、**SPF (TXT)** 及 **MX** 記錄。
   - 前往您的 DNS 管理商（例如 Cloudflare），新增這些 TXT 記錄。
   - **注意**：如果選擇使用 Resend 發送，請確保 DKIM TXT 記錄狀態顯示為 **Verified ✅**。
4. **取得 API Key**：
   - 點擊左側選單 **API Keys** -> **Create API Key**。
   - 名稱設為 `CTRCHK_PRODUCTION`，權限選 **Full Access**。
   - 複製生成的 `re_...` 密鑰。
5. **在 Vercel 設置環境變數**：
   - 前往 Vercel 專案 -> **Settings** -> **Environment Variables**。
   - 新增 `RESEND_API_KEY` = `re_xxxxxxxxxxxx`。
   - 確保已重新部署 (Redeploy) 以套用最新的環境變數。

---

## 步驟 2：接收外部郵件設置 (Inbound Webhook)

若您在 Resend 中開啟了 **Enable Receiving**，或者使用 Cloudflare Email Routing 轉發，請按照以下步驟設置 Webhook：

### 途徑 A：使用 Cloudflare Email Routing + Worker (推薦)

1. **開啟 Cloudflare Email Routing**：
   - 登入 Cloudflare，選擇 `ctrchk.com` 網域。
   - 進入 **Email** -> **Email Routing**，按指引自動新增 MX 記錄 (`isaac.mx.cloudflare.net` 等)。
2. **建立 Email Worker**：
   - 進入 **Workers & Pages** -> **Create Application** -> **Create Worker**。
   - 命名為 `ctrchk-email-webhook`。
   - 貼入以下 Worker 程式碼：

```javascript
export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const { default: PostalMime } = await import('https://esm.sh/postal-mime@2.3.1');
    const parser = new PostalMime();
    const email = await parser.parse(rawEmail);

    const payload = {
      action: "webhook-incoming",
      sender: message.from,
      recipient: message.to,
      subject: email.subject || "(無主旨)",
      body_text: email.text || "",
      body_html: email.html || "",
      secret: env.WEBHOOK_SECRET // 設定於 Worker 的環境變數中
    };

    const response = await fetch("https://ctrchk.com/api/email?action=webhook-incoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error("Webhook 回傳錯誤:", await response.text());
    }
  }
}
```

3. **設定 Catch-all 規則**：
   - 前往 **Email Routing** -> **Routing Rules**。
   - 編輯 **Catch-all address**，Action 選擇 **Send to Worker**，選擇剛剛建立的 `ctrchk-email-webhook`。

---

### 途徑 B：使用 Resend Inbound Webhooks

若您直接使用 Resend 的 Receiving 功能：

1. **在 Resend 中新增 Webhook**：
   - 前往 Resend 控制台 -> **Webhooks** -> **Add Webhook**。
2. **填寫 Webhook 網址 (Endpoint URL)**：
   - 輸入：`https://ctrchk.com/api/email?action=webhook-incoming`
3. **選擇事件 (Events)**：
   - 勾選 `email.received` 或 `email.delivered`。
4. **設定密鑰 (Secret Header)**：
   - 在 Webhook 請求中傳送 `secret`，或在 Vercel 環境變數中設置與 Cloudflare/Resend 一致的 `WEBHOOK_SECRET`。

---

## 步驟 3：檢查與測試診斷

1. **檢查收件帳戶是否存在**：
   - 電郵接收系統只會處理在 `email_accounts` 資料表中已創建的 `@ctrchk.com` 帳號。
   - 您可在管理員後台 **「郵件管理」** 頁面先建立該電郵地址（例如 `support@ctrchk.com` 或 `user@ctrchk.com`）。
   - 如果寄給未註冊的地址（例如 `unknown@ctrchk.com`），系統會在日誌記錄 `Recipient account not found, skipping` 並跳過存入。

2. **檢查環境變數清單 (Vercel Project Settings)**：

| 環境變數名稱 | 說明 | 範例/預設值 |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Resend API 金鑰 (發送郵件用) | `re_123456789...` |
| `WEBHOOK_SECRET` | 驗證 Webhook 請求安全金鑰 | 自訂長隨機字串 |
| `JWT_SECRET` | 郵件系統 JWT 登入憑證簽名 | 自訂長隨機字串 |
| `ADMIN_SECRET` | 建立企業郵件帳戶的管理員金鑰 | 自訂安全密碼 |
| `POSTGRES_URL` | Neon/PostgreSQL 資料庫連線字串 | `postgres://...` |

3. **發送測試郵件**：
   - 使用個人 Gmail / Outlook 發送一封測試郵件至已建立的 `yourname@ctrchk.com`。
   - 登入 `email-login.html` 查看收件匣是否成功顯示新郵件。
