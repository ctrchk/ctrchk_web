# 香港城市運輸單車 CTRC HK — 網站技術說明文件

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://ctrchk.com)

---

## 目錄

1. [專案簡介](#1-專案簡介)
2. [技術架構](#2-技術架構)
3. [功能總覽](#3-功能總覽)
4. [目錄結構](#4-目錄結構)
5. [環境變數設置](#5-環境變數設置)
6. [資料庫設置](#6-資料庫設置)
7. [會員系統說明](#7-會員系統說明)
8. [電郵驗證系統](#8-電郵驗證系統)
9. [管理員後台](#9-管理員後台)
10. [Google 登入設置](#10-google-登入設置)
11. [API 端點說明](#11-api-端點說明)
12. [部署指南（Vercel）](#12-部署指南vercel)
13. [本地開發](#13-本地開發)
14. [常見問題](#14-常見問題)
15. [路線資料提交指南](#15-路線資料提交指南)

---

## 1. 專案簡介

CTRC HK（香港城市運輸單車）是一個專為香港單車愛好者設計的資訊平台，提供：

- 🚲 **詳細路線資訊**：涵蓋將軍澳及各區多條單車路線
- 🗺️ **GPX 路線下載**：高級會員專屬，支援匯入 GPS 設備
- 👤 **會員系統**：支援電郵/密碼及 Google 第三方登入
- 📊 **騎行歷史**：記錄個人騎行資料
- 🛡️ **管理員後台**：管理用戶帳號及資料

---

## 2. 技術架構

| 元件 | 技術 |
|------|------|
| **前端** | 純 HTML / CSS / JavaScript（無框架） |
| **後端 API** | Vercel Serverless Functions（Node.js ES Module） |
| **資料庫** | PostgreSQL（透過 Neon 或 Vercel Postgres） |
| **認證** | JWT（jsonwebtoken）+ bcryptjs 密碼加密 |
| **Google 登入** | Google Identity Services (GIS) |
| **電郵發送** | Nodemailer + Gmail SMTP |
| **部署平台** | Vercel |

---

## 3. 功能總覽

### 前台功能

| 功能 | 說明 |
|------|------|
| 路線瀏覽 | 所有用戶均可查看路線概覽 |
| GPX 下載 | **高級會員限定**；未登入或初級會員顯示鎖定按鈕 |
| 用戶註冊 | 支援電郵/密碼，含確認密碼欄位及電郵驗證 |
| 用戶登入 | 支援電郵/密碼及 Google 第三方登入 |
| 自動登入 | 註冊成功後自動登入，無需再次登入 |
| 個人儀表板 | 顯示用戶名、會員狀態、騎行歷史 |
| 個人資料完善 | 填寫後升級為高級會員 |

### 會員分級

| 等級 | 中文名 | 說明 |
|------|--------|------|
| `junior` | 初級會員 | 預設等級，未填寫高級資料 |
| `senior` | 高級會員 | 已完善個人資料，可下載 GPX |
| `admin` | 管理員 | 可訪問後台管理介面 |

---

## 4. 目錄結構

```
ctrchk_web/
├── api/                        # Vercel Serverless Functions
│   ├── db.js                   # 資料庫連接工具
│   ├── config.js               # 前端配置 API（回傳 Google Client ID）
│   ├── register.js             # 用戶註冊
│   ├── login.js                # 用戶登入
│   ├── get-user.js             # 獲取用戶資料
│   ├── update-profile.js       # 更新個人資料（升級高級會員）
│   ├── google-auth.js          # Google OAuth 處理
│   ├── getHistory.js           # 獲取騎行歷史
│   ├── email.js                # 電郵發送工具（Nodemailer）
│   ├── verify-email.js         # 電郵驗證
│   ├── admin-users.js          # 管理員 API - 用戶管理
│   ├── admin-create.js         # 管理員 API - 建立帳戶
│   └── weather/                # 天氣 API
├── js/
│   ├── main.js                 # 全站通用腳本（路線、Header、GPX 鎖）
│   └── login.js                # 登入/註冊/登出處理
├── css/
│   └── main.css                # 全站樣式
├── images/                     # 路線圖片
├── gpx/                        # GPX 路線文件
├── index.html                  # 首頁
├── register.html               # 註冊頁
├── login.html                  # 登入頁
├── dashboard.html              # 用戶儀表板
├── profile-setup.html          # 個人資料完善頁
├── admin.html                  # 管理員後台
├── verify-email.html           # 電郵驗證結果頁
├── routes.html                 # 路線總覽頁
├── route_detail.html           # 路線詳情頁
├── about.html                  # 關於我們
├── blog.html                   # 部落格
├── contact.html                # 聯絡我們
├── header.html                 # 共用 Header 元件
├── database-schema.sql         # 資料庫建表 SQL
├── vercel.json                 # Vercel 部署配置
└── package.json                # Node.js 依賴
```

---

## 5. 環境變數設置

請在 Vercel 專案設定的「Environment Variables」中設置以下變數：

### 必填

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 連接字串 | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | JWT 簽名密鑰（建議 32+ 字元隨機字串） | `your-very-secret-key-here` |

### 選填（Google 登入）

| 變數名 | 說明 |
|--------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth 客戶端 ID |

### 選填（電郵驗證）

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `SMTP_USER` | Gmail 帳戶（或 `GMAIL_USER`） | `ctrcz9829@gmail.com` |
| `SMTP_PASS` | Gmail 應用程式密碼（非登入密碼） | `xxxx xxxx xxxx xxxx` |
| `BASE_URL` | 網站根網址（用於驗證連結） | `https://ctrchk.com` |

> ⚠️ Gmail 需開啟「兩步驗證」並使用「**應用程式密碼**」，而非登入密碼。
> 設定路徑：Google 帳戶 → 安全性 → 兩步驟驗證 → 應用程式密碼

> 💡 由於 enquiry@ctrchk.com 被重定向至 ctrcz9829@gmail.com，請使用 Gmail SMTP 設定。

---

## 6. 資料庫設置

### 建立資料表

在 Neon/Vercel Postgres 的 SQL 執行器中運行 `database-schema.sql`：

```sql
-- 建立/更新資料表（詳見 database-schema.sql）
```

### users 資料表欄位

| 欄位名 | 類型 | 說明 |
|--------|------|------|
| `id` | SERIAL PK | 用戶唯一 ID |
| `email` | VARCHAR(255) UNIQUE | 電子郵件 |
| `password_hash` | VARCHAR(255) | bcrypt 加密密碼（Google 用戶為 NULL） |
| `user_role` | VARCHAR(20) | `junior` / `senior` / `admin` |
| `full_name` | VARCHAR(100) | 真實姓名 |
| `phone` | VARCHAR(20) | 聯絡電話（選填） |
| `birthdate` | DATE | 出生日期（選填） |
| `experience` | VARCHAR(20) | 騎行經驗等級 |
| `bike_type` | VARCHAR(20) | 單車類型（選填） |
| `preferred_area` | TEXT | 騎行地區（逗號分隔多選） |
| `profile_completed` | BOOLEAN | 是否已完善資料 |
| `auth_provider` | VARCHAR(20) | `email` 或 `google` |
| `google_id` | VARCHAR(255) | Google OAuth 用戶 ID |
| `email_verified` | BOOLEAN | 是否已驗證電郵 |
| `verification_token` | VARCHAR(255) | 驗證 token（驗證後清空） |
| `verification_token_expiry` | TIMESTAMP | Token 過期時間（24 小時） |
| `created_at` | TIMESTAMP | 建立時間 |

---

## 7. 會員系統說明

### 註冊流程

1. 用戶填寫「基本資料」（必填：電郵、密碼、確認密碼、姓名）
2. 可選擇性填寫「高級會員資料」：
   - 若**完全不填**：以初級會員（junior）身份登入
   - 若**填齊所有欄位**（電話、騎行經驗、騎行地區）：以高級會員（senior）身份登入
   - 若**只填部分**：系統提示必須全部填寫或全部清空
3. 註冊成功後**自動登入**，直接進入用戶儀表板
4. 系統同時發送電郵驗證信（不影響登入，但建議完成驗證）

### 升級高級會員

初級會員可隨時前往「個人資料設置」頁面（`/profile-setup.html`）補填資料以升級。

### GPX 下載權限

| 用戶狀態 | GPX 下載按鈕 |
|----------|-------------|
| 未登入 | 🔒 鎖定，提示「前往登入」 |
| 初級會員 | 🔒 鎖定，提示「升級高級會員」 |
| 高級會員 | ✅ 可下載 |
| 管理員 | ✅ 可下載 |

### 騎行地區選項（多選）

- 港島海濱
- 九龍東
- 將軍澳
- 沙田區
- 大埔區
- 北區
- 元朗/天水圍
- 屯門
- 荃灣
- 離島/其他
- 香港以外

---

## 8. 電郵驗證系統

### 工作流程

```
用戶註冊
   ↓
API 產生隨機驗證 Token（32 bytes hex，有效 24 小時）
   ↓
系統發送驗證郵件至用戶電郵
   ↓
用戶點擊郵件中的連結（/verify-email?token=...）
   ↓
API 驗證 Token 有效性
   ↓
更新 email_verified = true，清除 token
   ↓
發送歡迎郵件
```

### 注意事項

- 電郵驗證不影響登入（用戶可在未驗證情況下正常使用）
- 驗證 token 使用後自動失效（避免重複使用）
- Token 有效期為 24 小時

### Gmail 應用程式密碼設置步驟

1. 登入 Google 帳號（ctrcz9829@gmail.com）
2. 前往「帳戶安全性」→「兩步驟驗證」（必須先開啟）
3. 在頁面底部找到「應用程式密碼」
4. 選擇應用程式類型（「其他」），輸入名稱如「CTRC HK」
5. 複製生成的 16 位密碼
6. 在 Vercel 設置 `SMTP_USER=ctrcz9829@gmail.com` 和 `SMTP_PASS=<16位密碼>`

---

## 9. 管理員後台

### 訪問方式

管理員帳戶**只能通過以下方式建立**，不可透過一般註冊頁面建立：

#### 方法一：透過管理員後台（推薦）

1. 先用現有管理員帳號登入
2. 前往 `/admin.html`
3. 點選「新增管理員」標籤
4. 填寫電郵、姓名及密碼（至少 12 位）

#### 方法二：直接使用 SQL

先生成密碼的 bcrypt hash（可使用以下 Node.js 腳本），再插入資料庫：

```javascript
// 生成管理員密碼 hash（在本地運行）
import bcrypt from 'bcryptjs';
const hash = bcrypt.hashSync('你的管理員密碼', 12);
console.log(hash);
```

```sql
INSERT INTO users (email, password_hash, user_role, full_name, profile_completed, auth_provider, email_verified)
VALUES ('admin@ctrchk.com', '<hash結果>', 'admin', 'CTRC HK 管理員', true, 'email', true);
```

### 後台功能

| 功能 | 說明 |
|------|------|
| 用戶列表 | 查看所有用戶（電郵、姓名、角色、騎行次數、總里程） |
| 搜尋用戶 | 按電郵或姓名搜尋 |
| 修改角色 | 升級/降級用戶（junior ↔ senior ↔ admin） |
| 刪除用戶 | 永久刪除用戶帳號 |
| 新增管理員 | 建立新管理員帳戶 |

> ⚠️ 管理員密碼**不**顯示於後台，管理員的個人信息受到保護。

---

## 10. Google 登入設置

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇專案
3. 啟用 Google Identity API
4. 建立 OAuth 2.0 憑據（Web Application）
5. 在「授權來源」中加入：
   - `https://ctrchk.com`
   - `http://localhost:3000`（本地測試用）
6. 複製「客戶端 ID」
7. 在 Vercel 設置環境變數 `GOOGLE_CLIENT_ID=<客戶端ID>`

---

## 11. API 端點說明

所有 API 位於 `/api/` 路徑下，透過 Vercel Serverless Functions 提供服務。

### 公開端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `POST /api/register` | POST | 用戶註冊（返回 JWT token，自動登入） |
| `POST /api/login` | POST | 用戶登入（返回 JWT token） |
| `POST /api/google-auth` | POST | Google OAuth 登入 |
| `GET /api/config` | GET | 獲取前端配置（Google Client ID） |
| `GET /api/verify-email?token=` | GET | 驗證電郵 token |

### 需要 JWT 驗證的端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `GET /api/get-user` | GET | 獲取用戶資料 |
| `POST /api/update-profile` | POST | 更新個人資料 |
| `GET /api/getHistory` | GET | 獲取騎行歷史 |

### 管理員專用端點（需要 admin 角色）

| 端點 | 方法 | 說明 |
|------|------|------|
| `GET /api/admin-users` | GET | 獲取用戶列表（支援分頁和搜尋） |
| `POST /api/admin-users` | POST | 修改用戶角色或刪除用戶 |
| `POST /api/admin-create` | POST | 建立新管理員/高級會員帳戶 |

### register API 請求範例

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "張三",
  "phone": "91234567",          // 選填
  "experience": "intermediate",  // 選填：beginner/intermediate/advanced/expert
  "preferred_area": "將軍澳,沙田區", // 選填：逗號分隔或陣列
  "birthdate": "1990-01-01",    // 選填
  "bike_type": "road"           // 選填
}
```

---

## 12. 部署指南（Vercel）

### 首次部署

1. Fork 此 GitHub 倉庫
2. 登入 [Vercel](https://vercel.com)
3. 點擊「New Project」，選擇 GitHub 倉庫
4. 設置「Framework Preset」為 **Other**
5. 點擊「Deploy」

### 設置環境變數

在 Vercel 專案 → Settings → Environment Variables 中添加：

```
DATABASE_URL = postgresql://...
JWT_SECRET = your-jwt-secret
GOOGLE_CLIENT_ID = your-google-client-id (可選)
SMTP_USER = ctrcz9829@gmail.com (可選)
SMTP_PASS = your-gmail-app-password (可選)
BASE_URL = https://ctrchk.com
```

### 設置資料庫

1. 在 Vercel 儀表板點擊「Storage」→「Connect Store」→「Neon」
2. 或使用外部 Neon 帳號，複製連接字串至 `DATABASE_URL`
3. 在 Neon 的 SQL 編輯器中執行 `database-schema.sql`

---

## 13. 本地開發

```bash
# 安裝依賴
npm install

# 安裝 Vercel CLI（如尚未安裝）
npm install -g vercel

# 建立本地環境變數文件
cp .env.example .env.local
# 編輯 .env.local 填入本地/測試資料庫連接字串等

# 啟動本地開發伺服器（模擬 Vercel）
vercel dev
```

> 💡 `vercel dev` 會自動讀取 `.env.local` 並模擬 Serverless Functions 環境。

---

## 14. 常見問題

### Q: 電郵驗證郵件沒有收到？

- 確認 `SMTP_USER` 和 `SMTP_PASS` 環境變數已正確設置
- 確認 Gmail 已開啟兩步驗證並使用**應用程式密碼**（非登入密碼）
- 檢查 Vercel 函數日誌（Functions → Logs）
- 確認 `BASE_URL` 設置為正確的網站網址

### Q: 如何創建第一個管理員帳戶？

由於後台需要管理員帳戶才能訪問，首次需通過 SQL 直接在資料庫建立：

1. 使用 Node.js 生成密碼 hash：`bcrypt.hashSync('密碼', 12)`
2. 在 Neon SQL 編輯器中執行 INSERT 語句（見上方「管理員後台」章節）

### Q: 資料庫連接失敗？

確認 `DATABASE_URL` 格式正確，且包含 `?sslmode=require`（Neon 要求 SSL）：
```
postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
```

### Q: JWT token 無效？

- 確認 `JWT_SECRET` 在所有環境（Vercel Production/Preview）一致
- Token 有效期為 7 天，過期需重新登入

### Q: Google 登入按鈕沒有顯示？

- 確認 `GOOGLE_CLIENT_ID` 已設置
- 確認 Google Cloud Console 中的「授權來源」包含當前網域
- 確認頁面中已載入 `https://accounts.google.com/gsi/client`

---

## 15. 路線資料提交指南

> **⚠️ 重要說明：如何及何時提交路線站點、位置及解鎖機制資料**

### 15.1 需要提交哪些資料？

每條新路線需要提供以下資料才能在 App 中完整運作：

#### 沿途站點及位置（必需）
每個站點需要提供以下欄位：

```json
{
  "order": 1,           // 站點順序（從 1 開始）
  "name": "站點名稱",    // 中文站點名稱（例如「調景嶺站」）
  "lat": 22.3078,       // 緯度（小數點後4位，可從 Google Maps 取得）
  "lon": 114.2694       // 經度（小數點後4位）
}
```

**如何獲取座標：**
1. 在 Google Maps 中找到站點位置
2. 右鍵點擊 → 選「這是什麼地方？」
3. 頁面底部會顯示緯度、經度（例如 `22.3078, 114.2694`）

#### 路線解鎖條件（必需）
每條路線的解鎖設定：

| 欄位 | 說明 | 範例 |
|------|------|------|
| `unlock_level` | 需要達到幾級才能解鎖（1 = 初始路線，無需升級） | `4` |
| `unlock_cost` | 解鎖所需里程幣數量（`null` = 升級自動解鎖，數字 = 需購買） | `500` 或 `null` |
| `is_special` | 是否只能用里程幣購買（不能靠升級解鎖） | `true` 或 `false` |
| `xp_reward` | 完成路線可獲得的 XP 數量 | `130` |

### 15.2 提交格式

請以 **GitHub Issue** 或直接在 PR 的留言區提交，格式如下：

```
路線 ID：[路線編號，例如 966T]
路線別稱：[中文別稱]

站點列表：
1. [站點名稱] - 緯度: 22.xxxx, 經度: 114.xxxx
2. [站點名稱] - 緯度: 22.xxxx, 經度: 114.xxxx
（依此類推...）

解鎖條件：
- 解鎖等級（前端 50 級系統）：[數字，例如 8]
- 解鎖等級（資料庫 20 級系統）：[數字，例如 4]
- 是否需要里程幣：[是/否]
- 里程幣數量（如適用）：[數字]
- XP 獎勵：[數字]
```

### 15.3 提交時機

- **建議在路線確認實際可以單車通行後**立即提交站點資料
- 每次提交後，開發者將更新 `routes.json`（前端路線詳情頁）、`js/main.js`（路線列表）及 `database-schema.sql`（資料庫）

### 15.4 現有路線狀態

| 路線 ID | 解鎖方式 | 站點資料狀態 |
|---------|---------|-------------|
| 900, 900A | 初始路線（等級 1） | ✅ 已有 |
| 966T | 初始路線（等級 1） | ⚠️ 暫用佔位資料（待確認） |
| 966 | 等級 4 解鎖 | ✅ 已有（原初始路線） |
| 914 | 等級 4/8 解鎖 | ✅ 已有 |
| 920 | 等級 10 解鎖 + **里程幣 800**（暫定） | ✅ 已有 |
| 900S | 等級 13 解鎖 + **里程幣 600**（暫定） | ❌ 待提交 |
| 914B | 等級 7 解鎖 + **里程幣 500**（暫定） | ❌ 待提交 |
| 961P | 等級 20 解鎖 + **里程幣 800**（暫定） | ❌ 待提交 |
| 962P | 等級 20 解鎖 + **里程幣 1000**（暫定） | ❌ 待提交 |
| 962X | 等級 20 解鎖 + **里程幣 1000**（暫定） | ❌ 待提交 |

> **注意：** 里程幣路線（900S、914B、920、961P、962P、962X）的里程幣費用為**暫定值**，具體金額請在確認後通知開發者更新。

---

## 版權聲明

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.

本專案僅供 CTRC HK 官方使用。
