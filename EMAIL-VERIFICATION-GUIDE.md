# 📧 電郵驗證設置指南（超級詳細版）

> **適用對象：** CTRC HK 網站管理員  
> **最後更新：** 2026年3月  
> **難度：** ⭐⭐⭐（中等）

---

## 目錄

1. [電郵驗證系統概覽](#1-電郵驗證系統概覽)
2. [第一步：建立 Gmail 應用程式密碼](#2-第一步建立-gmail-應用程式密碼)
3. [第二步：在 Vercel 設置環境變數](#3-第二步在-vercel-設置環境變數)
4. [第三步：驗證設置是否正確](#4-第三步驗證設置是否正確)
5. [常見問題排解](#5-常見問題排解)
6. [技術說明（可選閱讀）](#6-技術說明可選閱讀)

---

## 1. 電郵驗證系統概覽

### 系統如何運作？

當用戶在網站上完成註冊後，系統會：

1. 在資料庫中建立用戶帳戶，並將 `email_verified` 設為 `false`
2. 生成一個隨機的驗證 Token（256位元加密字串），儲存至資料庫，有效期 24 小時
3. 通過 Gmail SMTP 向用戶的電子郵件發送含驗證連結的郵件
4. 用戶點擊郵件中的連結，後端驗證 Token 是否有效及未過期
5. 驗證成功後，`email_verified` 設為 `true`，Token 從資料庫清除

### 相關檔案

| 檔案 | 用途 |
|------|------|
| `api/_email.js` | 電郵發送工具（使用 nodemailer） |
| `api/register.js` | 用戶註冊，觸發驗證郵件發送 |
| `api/verify-email.js` | 處理用戶點擊驗證連結 |
| `verify-email.html` | 驗證結果頁面 |

---

## 2. 第一步：建立 Gmail 應用程式密碼

> ⚠️ **重要：** 必須使用「應用程式密碼」，不能直接使用 Google 帳戶密碼。

### 2.1 開啟兩步驟驗證（如未開啟）

1. 用 **ctrcz9829@gmail.com** 或您指定的發件人帳戶登入 [myaccount.google.com](https://myaccount.google.com)
2. 點擊左側選單的 **「安全性」**
3. 在「Google 登入方式」下找到 **「兩步驟驗證」**
4. 點擊進入並按指示開啟（需要輸入電話號碼進行驗證）
5. 確認兩步驟驗證已**開啟**（顯示「開啟」狀態）

### 2.2 生成應用程式密碼

1. 返回 **「安全性」** 頁面
2. 在「Google 登入方式」下，找到 **「應用程式密碼」**（必須先開啟兩步驟驗證才會顯示此選項）
3. 點擊「應用程式密碼」
4. 在「選擇應用程式」下拉選單中，選擇 **「其他（自訂名稱）」**
5. 在名稱欄位輸入：`CTRC HK Website`（方便識別）
6. 點擊 **「生成」**
7. 系統會顯示一組 **16 位英文字母密碼**，例如：`abcd efgh ijkl mnop`

> 🔑 **立即複製這組密碼！** 關閉視窗後將無法再次查看。

> 💡 **提示：** 複製時包含空格，或去除空格均可，系統都能識別。

---

## 3. 第二步：在 Vercel 設置環境變數

### 3.1 登入 Vercel 控制台

1. 前往 [vercel.com](https://vercel.com)，使用您的帳戶登入
2. 在 Dashboard 中找到 **「ctrchk_web」** 專案，點擊進入

### 3.2 進入環境變數設置

1. 點擊頂部選單的 **「Settings」**（設置）
2. 在左側選單找到 **「Environment Variables」**（環境變數）
3. 點擊進入

### 3.3 新增 SMTP_USER 環境變數

1. 點擊 **「Add New」** 或 **「+ Add」** 按鈕
2. 填寫以下資訊：
   - **Name（名稱）：** `SMTP_USER`
   - **Value（值）：** 您的 Gmail 地址，例如 `ctrcz9829@gmail.com`
   - **Environment（環境）：** 勾選 `Production`、`Preview`、`Development` 三個選項
3. 點擊 **「Save」** 儲存

### 3.4 新增 SMTP_PASS 環境變數

1. 再次點擊 **「Add New」** 或 **「+ Add」**
2. 填寫以下資訊：
   - **Name（名稱）：** `SMTP_PASS`
   - **Value（值）：** 剛才從 Google 取得的 **16 位應用程式密碼**（例如 `abcdefghijklmnop`，去除空格）
   - **Environment（環境）：** 勾選 `Production`、`Preview`、`Development` 三個選項
3. 點擊 **「Save」** 儲存

### 3.5 確認其他必要環境變數

請確認以下環境變數也已設置（用於系統整體功能）：

| 變數名稱 | 說明 | 範例值 |
|----------|------|--------|
| `SMTP_USER` | 發件人 Gmail 地址 | `ctrcz9829@gmail.com` |
| `SMTP_PASS` | Gmail 應用程式密碼 | `abcdefghijklmnop` |
| `JWT_SECRET` | JWT 加密金鑰（32位以上隨機字串） | `your-very-long-random-secret-key` |
| `POSTGRES_URL` | 資料庫連線字串 | `postgresql://user:pass@host/db` |
| `GOOGLE_CLIENT_ID` | Google OAuth 客戶端 ID | `xxxx.apps.googleusercontent.com` |

### 3.6 重新部署以套用環境變數

> ⚠️ **重要：** 新增環境變數後，需要重新部署才會生效！

1. 在 Vercel 控制台，點擊頂部選單的 **「Deployments」**（部署記錄）
2. 找到最新的部署記錄
3. 點擊右側的 **「…」** 選單
4. 選擇 **「Redeploy」**（重新部署）
5. 在彈出視窗中，確認取消勾選「Use existing Build Cache」（以確保套用新環境變數）
6. 點擊 **「Redeploy」** 確認

等待約 1-3 分鐘，部署完成後環境變數即生效。

---

## 4. 第三步：驗證設置是否正確

### 4.1 測試電郵發送

1. 在您的網站上，用一個**測試用電子郵件地址**完成新用戶註冊
2. 前往該郵件地址的收件箱
3. 查找來自 `ctrcz9829@gmail.com`（或您設置的 SMTP_USER）的郵件
   - 主題應為類似：`「驗證您的 CTRC HK 帳戶電子郵件」`
4. 點擊郵件中的驗證連結
5. 應跳轉至網站的驗證成功頁面

### 4.2 確認驗證成功

登入帳戶後，進入用戶儀表板（Dashboard），確認：
- 「電郵驗證」狀態顯示 ✅ **已驗證**
- 不再顯示「請驗證你的電子郵件」的橙色提示橫幅

### 4.3 如果郵件未收到

請先檢查：
1. 收件箱的**垃圾郵件夾** / **促銷郵件夾**（Gmail 可能自動分類）
2. 等待約 **1-5 分鐘**（郵件伺服器可能有延遲）
3. 如仍未收到，請參考下方「常見問題排解」

---

## 5. 常見問題排解

### ❌ 問題：郵件一直收不到

**可能原因 1：** SMTP 環境變數未正確設置

✅ 解決方法：
- 進入 Vercel → Settings → Environment Variables，確認 `SMTP_USER` 和 `SMTP_PASS` 的值正確
- 確認兩個值中沒有多餘的空格或換行符

**可能原因 2：** 未重新部署

✅ 解決方法：
- 按照上方 [3.6 重新部署](#36-重新部署以套用環境變數) 的步驟重新部署

**可能原因 3：** Gmail 帳戶的兩步驟驗證未開啟

✅ 解決方法：
- 確認 Gmail 帳戶已開啟兩步驟驗證，否則無法生成應用程式密碼

**可能原因 4：** 使用了錯誤的密碼

✅ 解決方法：
- 重新生成一組新的應用程式密碼（舊密碼可以撤銷後重新生成）
- 確認 `SMTP_PASS` 環境變數使用的是「應用程式密碼」，而非 Google 帳戶密碼

---

### ❌ 問題：Vercel 函數錯誤（500 Internal Server Error）

**可能原因：** 環境變數名稱打錯

✅ 解決方法：
- 確認環境變數名稱**完全正確**（區分大小寫）：`SMTP_USER`、`SMTP_PASS`

**查看錯誤日誌：**
1. 進入 Vercel 控制台
2. 點擊 **「Functions」** 標籤
3. 找到 `/api/register` 函數
4. 查看錯誤日誌，尋找 SMTP 相關的錯誤訊息

---

### ❌ 問題：驗證連結顯示「已過期」

**原因：** 驗證 Token 的有效期為 **24 小時**，過期後需要重新申請。

✅ 解決方法（暫時方案）：
- 請用戶重新到儀表板頁面，點擊「重新發送驗證郵件」按鈕（如有此功能）
- 或讓用戶重新確認電郵

> 📝 **注意：** 如需延長有效期，可修改 `api/register.js` 中的 `24 * 60 * 60 * 1000`（目前為24小時），例如改為 `72 * 60 * 60 * 1000`（72小時）。

---

### ❌ 問題：Gmail 封鎖了 SMTP 連線

**原因：** Google 近年加強了安全性，不允許直接使用帳戶密碼通過 SMTP 發送郵件。

✅ 解決方法：
- **必須** 使用「應用程式密碼」，不能使用普通帳戶密碼
- 確認在 Google 帳戶設定中「允許低安全性應用程式存取」**不是**解決方案（已被 Google 停用）
- 使用應用程式密碼是目前唯一的官方推薦方法

---

## 6. 技術說明（可選閱讀）

### 6.1 代碼架構

本系統使用 **nodemailer** 函式庫通過 Gmail SMTP 發送電郵。

主要設定（`api/_email.js`）：

```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,   // Gmail 地址
        pass: process.env.SMTP_PASS    // Gmail 應用程式密碼
    }
});
```

### 6.2 驗證 Token 生成機制

```javascript
// 生成256位隨機十六進制字串
const verificationToken = crypto.randomBytes(32).toString('hex');
// 24小時後過期
const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
```

### 6.3 驗證連結格式

驗證郵件中的連結格式為：

```
https://[您的域名]/verify-email?token=[verificationToken]
```

例如：`https://ctrchk.vercel.app/verify-email?token=abc123...`

### 6.4 資料庫欄位

用戶表（`users`）中相關欄位：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `email_verified` | BOOLEAN | 電郵是否已驗證（預設 false） |
| `verification_token` | VARCHAR(255) | 驗證 Token（驗證後清空） |
| `verification_token_expiry` | TIMESTAMP | Token 過期時間 |

### 6.5 如果想更換發件人郵件服務

如果不想使用 Gmail，可以更改 `api/_email.js` 中的 transporter 設定，使用其他 SMTP 服務提供商，例如：
- **SendGrid** - 每月免費 100 封
- **Resend** - 每月免費 3,000 封
- **Mailgun** - 提供免費試用
- **其他支援 SMTP 的服務商**

---

## 快速設置清單

完成以下步驟即可啟用電郵驗證功能：

- [ ] 1. 在 Google 帳戶開啟兩步驟驗證
- [ ] 2. 在 Google 帳戶生成「應用程式密碼」（16位字母）
- [ ] 3. 在 Vercel → Settings → Environment Variables 新增 `SMTP_USER`（Gmail 地址）
- [ ] 4. 在 Vercel → Settings → Environment Variables 新增 `SMTP_PASS`（應用程式密碼）
- [ ] 5. 在 Vercel → Deployments 重新部署專案
- [ ] 6. 測試：新用戶註冊 → 收到驗證郵件 → 點擊連結 → 驗證成功

---

*如有任何技術問題，請透過網站的聯絡表格與 CTRC HK 技術團隊聯繫。*
