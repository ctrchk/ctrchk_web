# In-App Email System Setup Guide (@ctrchk.com)

This guide provides step-by-step instructions for setting up a custom, self-hosted email system using Resend (for sending) and Cloudflare Email Routing + Workers (for receiving).

## 1. Neon Database Setup
Run the following SQL script in your Neon PostgreSQL console to create the necessary tables.

```sql
-- Create Email Accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Email Messages table
CREATE TABLE IF NOT EXISTS email_messages (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES email_accounts(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOX', 'SENT')),
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body_text TEXT,
    body_html TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email_address ON email_accounts(email_address);
```

---

## 2. Resend Setup (Sending)
1.  **Create an account** at [resend.com](https://resend.com).
2.  **Add Domain**: Go to "Domains" -> "Add Domain". Enter `ctrchk.com`.
3.  **Verify DNS**: Resend will provide MX, TXT, and CNAME records. Add these to your Cloudflare DNS settings.
4.  **API Key**: Go to "API Keys" -> "Create API Key". Give it "Full Access".
5.  **Vercel Env Var**: Add `RESEND_API_KEY` to your Vercel project environment variables.

---

## 3. Cloudflare Setup (Receiving)

### Step A: Enable Email Routing
1.  Log in to Cloudflare, select `ctrchk.com`.
2.  Go to **Email** -> **Email Routing**.
3.  Follow the wizard to enable it and configure the necessary DNS records.

### Step B: Create a Cloudflare Worker
1.  Go to **Workers & Pages** -> **Overview** -> **Create application** -> **Create Worker**.
2.  Name it `email-to-webhook-parser`.
3.  Deploy the following code.
    *Note: To handle dependencies like `postal-mime` in the Cloudflare Dashboard, we use a CDN import.*

```javascript
/**
 * Cloudflare Email Worker to parse incoming emails and POST to Vercel Webhook
 */

export default {
  async email(message, env, ctx) {
    // 1. Parse the raw email using PostalMime from a CDN
    const rawEmail = await new Response(message.raw).arrayBuffer();

    // Using esm.sh to import PostalMime without a local build step
    const { default: PostalMime } = await import('https://esm.sh/postal-mime@2.3.1');
    const parser = new PostalMime();
    const email = await parser.parse(rawEmail);

    // 2. Prepare the payload
    const payload = {
      action: "webhook-incoming",
      sender: message.from,
      recipient: message.to,
      subject: email.subject,
      body_text: email.text,
      body_html: email.html,
      secret: env.WEBHOOK_SECRET // Set this in Worker Settings -> Variables
    };

    // 3. POST to Vercel Webhook
    const response = await fetch("https://ctrchk.com/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error("Webhook failed:", await response.text());
    }
  }
}
```

### Step C: Attach Worker to Catch-all
1.  Go back to **Email** -> **Email Routing** -> **Routing Rules**.
2.  Enable **Catch-all address**.
3.  Set "Action" to **Send to Worker**.
4.  Select your `email-to-webhook-parser` Worker.

---

## 4. Vercel Environment Variables
Ensure the following variables are set in your Vercel Project Settings:

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Your Neon connection string |
| `RESEND_API_KEY` | Your Resend API Key |
| `WEBHOOK_SECRET` | A long random string (must match Cloudflare Worker Env Var) |
| `ADMIN_SECRET` | A secret key required to create new email accounts via API |
| `JWT_SECRET` | A secret key for signing login tokens |

---

## 5. API Endpoints Created
All email functions are consolidated into a single serverless function to comply with Vercel Hobby plan limits.

- `POST /api/email?action=create-account`: Create a new `@ctrchk.com` account. Requires `admin_secret` in body.
- `POST /api/email?action=login`: Login and receive a JWT token.
- `POST /api/email?action=send`: Send an email (requires Bearer token).
- `POST /api/email?action=webhook-incoming`: The secure endpoint for Cloudflare Workers.

---

## 6. User Actions Required
If you are seeing "relation does not exist" errors, the system is designed to automatically attempt table creation on the first API call. However, if problems persist, ensure your `DATABASE_URL` has sufficient permissions to `CREATE TABLE`.

### Maintenance
To manually trigger table creation/verification, simply visit or call any `/api/email` endpoint.

### Accessing CTRCHK Mail
- **Admin**: Go to the "郵件管理" (Email Admin) tab in the Admin Panel.
- **User**: Go to the "更多" (More) section in your Dashboard.
