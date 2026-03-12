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
16. [每日/每週任務與成就系統](#16-每日每週任務與成就系統)
17. [App 騎行部門選擇](#17-app-騎行部門選擇)
18. [最近更新記錄](#18-最近更新記錄)

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
  "order": 1,              // 站點順序（從 1 開始）
  "code": "POA 01",        // 站點編號（區域縮寫 + 序號）
  "name": "新都城二期、寶琳邨", // 中文站點名稱
  "name_en": "Metro City Plaza II, Po Lam Estate", // 英文名稱
  "road": "寶豐路",         // 所在道路（若與上一站相同可省略）
  "direction": "🔴",       // 行駛方向（見下方說明）
  "district": "POA",       // 所屬分區代碼
  "xp": 10,                // 到站 XP（0 = 此方向不加 XP）
  "lat": 22.3242,          // 緯度（小數點後4位）
  "lon": 114.2570          // 經度（小數點後4位）
}
```

#### 行駛方向說明（`direction` 欄位）

| 符號 | 說明 |
|------|------|
| 🔴 | 上端總站（此路線起點，停靠方向 = 下行出發站） |
| 🟢 | 下端總站（此路線終點） |
| ↕️ | 雙向停靠（上下行均停） |
| ⬆️ | 僅上行停靠（往上端總站方向） |
| ⬇️ | 僅下行停靠（往下端總站方向） |
| 🟡 | 可選停靠 |
| 🔃 | 循環線折返點 |

> **注意：** `direction: "⬆️"` 的站點在下行方向（`dir_filter: "down"`）會被自動跳過；`direction: "⬇️"` 的站點在上行方向（`dir_filter: "up"`）會被自動跳過。

#### GPX 行駛方向設定

對於雙向路線，`routes.json` 的 `gpx` 欄位中每條記錄需包含 `dir_filter`：

| `dir_filter` 值 | 說明 |
|----------------|------|
| `"down"` | 下行（正順序，從 🔴 走到 🟢，排除 ⬆️ 站） |
| `"up"` | 上行（逆順序，從 🟢 走到 🔴，排除 ⬇️ 站） |
| `"cw"` / `"ccw"` | 循環線順時針/逆時針 |
| 省略 | 不過濾，顯示所有站 |

**示例（路線 900）：**
```json
"gpx": [
  { "label": "往寶琳",   "file": "900寶琳.gpx",   "dir_filter": "up"   },
  { "label": "往調景嶺", "file": "900調景嶺.gpx", "dir_filter": "down" }
]
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

> **重要：** 只有已正式提交站點資料的路線才會在 App 中顯示可騎行站點。其餘路線僅保留基本路線資訊（名稱、起終點等），騎行站點留空待補充。

| 路線 ID | 解鎖方式 | 站點資料狀態 |
|---------|---------|-------------|
| **900** | 初始路線（等級 1） | ✅ **已驗證**（20 站，含方向標記） |
| **900A** | 初始路線（等級 1） | ✅ **已驗證**（15 站，含方向標記，XP 上限 290） |
| **966T** | 初始路線（等級 1） | ✅ **已驗證**（2 站，無中途站，完成獎勵 300 XP） |
| 966 | 等級 8 解鎖 | ❌ 站點待提交 |
| 914 | 等級 8 解鎖 | ❌ 站點待提交 |
| 其他路線 | 各路線對應等級 | ❌ 站點待提交 |

### 15.5 路線 900A 站點詳情

**西貢區 將軍澳部 ‧ 寶調特快**  
15 站 ‧ 每方向 14 站 ‧ 每站 +10 XP ‧ 每跨區 +20 XP ‧ 完成 +150 XP ‧ 30 分鐘內完成額外 +5 里程幣

| 順序 | 代碼 | 中文名 | 英文名 | 道路 | 方向 |
|------|------|--------|--------|------|------|
| 1 | POA 01 | 新都城二期、寶琳邨 | Metro City Plaza II, Po Lam Estate | 寶豐路 | 🔴 |
| 2 | POA 02 | 欣明苑、將軍澳賽馬會診所 | Yan Ming Court, Tseung Kwan O Jockey Club Clinic | 寶琳北路 | ↕️ |
| 3 | POA 03 | 景林邨轉乘站——景林邨景棉樓 | King Lam Estate Interchange - King Min House King Lam Estate | — | ↕️ |
| 4 | POA 04 | 景林邨轉乘站——景林邨滑板公園 | King Lam Estate Interchange - King Lam Estate Roller Skating Park | 寶順路 | ↕️ |
| 5 | HAH 02 | 寶順路轉乘站 | Po Shun Road Interchange | — | ↕️ |
| 6 | HAH 10 | 常寧遊樂場 | Sheung Ning Playground | 環保大道 | ↕️ |
| 7 | HAH 11 | 將軍澳極限運動場 | Tseung Kwan O Skatepark | — | ↕️ |
| 8 | TKO 08 | Green Field 公園、靈實醫院 | Green Field Park, Haven of Hope Hospital | 寶順路 | ↕️ |
| 9 | TKO 09 | 尚德邨停車場 | Sheung Tak Estate Carpark | — | ↕️ |
| 10 | TIK 03 | 彩明苑彩桃閣 | Choi Ming Court Choi To House | — | ⬇️ |
| 11 | TIK 11 | 將軍澳中心 | Park Central | 單車徑 | ↕️ |
| 12 | TIK 02 | 調景嶺體育館 | Tiu Keng Leng Sports Centre | 翠嶺路 | ↕️ |
| 13 | TIK 12 | 調景嶺站-知專設計學院總站 | Tiu Keng Leng Station - IVE (Tuen Mun) Terminus | — | ↕️ |
| 14 | TIK 01 | 調景嶺站、維景灣畔 | Tiu Keng Leng Station, Ocean Shores | 唐賢街 | ⬆️ |
| 15 | TIK 06 | 調景嶺總站 | Tiu Keng Leng Terminus | 單車徑 | 🟢 |

### 15.6 路線 966T 站點詳情

**西貢區 將軍澳部 ‧ 大橋旅遊線**  
2 站（不設中途站）‧ 完成 +300 XP ‧ 15 分鐘內完成額外 +5 里程幣

| 順序 | 代碼 | 中文名 | 英文名 | 道路 | 方向 | 座標 |
|------|------|--------|--------|------|------|------|
| 1 | TIK 13 | 調景嶺站-出口 | Tiu Keng Leng Station - Exit | 景嶺路 | 🔴 | 22.30465° N, 114.25305° E |
| 2 | LHP 06 | 康城站 | Lohas Park Station | 康城路 | 🟢 | 22.29626° N, 114.26692° E |

> **注意：** 未提交站點的路線在騎行介面中無法顯示沿途站點和追蹤功能，但仍可在路線清單中查看基本資訊。請按 **15.2 提交格式**提交，格式須包含 `code`、`direction`、`district`、`xp` 等完整欄位。

---

## 16. 每日/每週任務與成就系統

### 16.1 概覽

任務與成就系統位於 `/tasks` 頁面，在 PWA App 底部導航欄可見「任務」按鈕。

### 16.2 任務類型

#### 每日任務（每天午夜重置）

| 任務 | 條件 | 獎勵 |
|------|------|------|
| 出發！ | 完成任意一次騎行 | +50 XP |
| 站點打卡 | 到達 5 個站點 | +30 XP |
| 持續騎行 | 單次騎行超過 20 分鐘 | +20 XP |
| 今日挑戰 | 完成每日指定路線（900 線） | +80 XP + 5 🪙 |

#### 每週任務（每週一重置）

| 任務 | 條件 | 獎勵 |
|------|------|------|
| 週週騎行 | 本週完成 3 次騎行 | +150 XP + 10 🪙 |
| 海濱漫遊 | 完成 900 線（市區海濱線） | +100 XP + 8 🪙 |
| 調景嶺探索 | 到達所有 TIK 區站點 | +100 XP + 8 🪙 |
| 十公里達人 | 本週累計騎行 10 公里 | +120 XP + 10 🪙 |

### 16.3 成就獎牌

| 成就 | 圖示 | 條件 |
|------|------|------|
| 首次出發 | 🚀 | 完成第一次騎行 |
| 探索者 | 🗺️ | 完成 5 條不同路線 |
| 海濱達人 | 🌊 | 完成路線 900 全程 |
| 速度達人 | ⚡ | 45 分鐘內完成 900 線 |
| 全程達成 | ⭐ | 單次騎行到達所有站點 |
| 跨區騎士 | 🗾 | 單次騎行跨越 3 個或以上分區 |
| 每日打卡 | 🗓️ | 連續 7 天完成每日任務 |
| 耐力達人 | 💪 | 累計騎行 50 公里 |
| 集站王者 | 📍 | 到達 50 個不重複站點 |
| 將軍澳通 | 🏅 | 完成所有將軍澳部路線 |
| 週末騎手 | ☀️ | 連續 4 個週末騎行 |
| 夜行者 | 🌙 | 在晚上 8 點後完成騎行 |

### 16.4 每日簽到

`/tasks` 頁面頂部設有**每日簽到**卡片，用戶每天點擊一次即可獲取獎勵：

| 獎勵項目 | 數量 |
|----------|------|
| 每日簽到 XP | +30 XP |
| 每日簽到里程幣 | +1 🪙 |
| 連續 7 天倍率 | 額外 +1 🪙（每滿 7 天） |

- 簽到記錄儲存於 `localStorage.dailyCheckins`（鍵為日期 `YYYY-MM-DD`）
- 頁面顯示**連續簽到天數**（🔥 N 天）

### 16.5 路線完成要求（已更新）

**每日任務** 和 **每週任務** 中指定路線類型（`specific_route`）的任務，現在必須**徹底完成全程所有站點**（`all_stops = true`）才算達成。此修改確保用戶實際完成整條路線，而非只是開始騎行。

### 16.6 技術實現

任務進度目前以 `localStorage` 追蹤（`rideHistory` 鍵），待後端資料庫整合後可遷移至伺服器端。每次騎行結束後，`ride.html` 會自動將本次騎行記錄寫入 `localStorage.rideHistory`。

---

## 17. App 騎行部門選擇

### 17.1 兩頁式導航

PWA App 模式下，騎行功能分為兩個獨立頁面：

| 頁面 | URL | 說明 |
|------|-----|------|
| 部門選擇 | `/routes` | 選擇騎行部門（如將軍澳部） |
| 路線選擇 | `/routes?dept=tko` | 選擇具體路線，查看地圖 |

點擊部門後 URL 會更新為 `/routes?dept=<dept_id>`，瀏覽器返回鍵可回到部門選擇頁面。

### 17.2 現有部門

| 部門 ID | 部門名稱 | 行政區 | 狀態 |
|---------|---------|--------|------|
| `tko` | 將軍澳部 | 西貢區 | ✅ 可用 |
| `st` | 沙田部 | 沙田區 | 🔒 規劃中 |

### 17.3 雙向路線停靠邏輯

騎行時根據選擇方向（`dir_filter`）自動過濾站點：

- **下行（`down`）**：按 `routes.json` 站點順序，排除 `direction: "⬆️"` 的站點
- **上行（`up`）**：反轉站點順序，排除 `direction: "⬇️"` 的站點

---

## 18. 最近更新記錄

### 18.1 2026-03 路線資料更新

#### ✅ 已完成

| 項目 | 說明 | 相關檔案 |
|------|------|---------|
| 路線 900A 站點提交 | 新增 15 個站點（含座標、方向、XP）；XP 上限更新為 290；快速完成時限 30 分鐘 | `routes.json`, `database-schema.sql` |
| 路線 966T 站點提交 | 新增 2 個站點（不設中途站）；XP 更新為 300（僅完成獎勵）；快速完成時限 15 分鐘 | `routes.json`, `database-schema.sql` |
| 每路線自訂完成 XP | `routes.json` 新增 `completion_xp` 及 `fast_finish_minutes` 欄位；`ride.html` 讀取並套用 | `routes.json`, `ride.html` |
| App 主頁移除天氣 | 快捷功能格替換「天氣」→「任務」連結 | `index.html` |
| 路線任務完成要求 | 每日/每週路線任務改為需要徹底完成全程所有站點（`all_stops = true`）方可計算 | `tasks.html` |
| 每日簽到功能 | `/tasks` 頁面新增每日簽到卡片（+30 XP + 1 里程幣；連續 7 天額外 +1 里程幣） | `tasks.html` |

#### 🔧 待改進（計劃中）

| 項目 | 說明 |
|------|------|
| 騎行開始前須抵達起點 | 開始路線後顯示「前往起點」狀態，待用戶進入起點 50m 範圍後才正式計時 |
| 騎行地圖觀感優化 | 騎行中地圖改用深色主題（CartoDB Dark）；HUD 樣式整理 |
| 更多總站地圖標記 | `routes.html` 地圖上的總站標記可由 `routes.json` 設定（待設計） |
| 網頁路線詳情更新 | `route_detail.html` 各路線站點詳情依已提交資料展示（待逐條更新） |
| 每日簽到後端整合 | 目前簽到記錄僅在 `localStorage`，待遷移至資料庫以支援多設備同步 |

### 18.2 路線 XP 系統說明

| 獎勵類型 | 數值 | 觸發條件 |
|----------|------|---------|
| 到站 XP | +10 XP / 站 | 進入站點 50m 範圍 |
| 跨區 XP | +20 XP / 次 | 首次進入新分區（POA / HAH / TKO / TIK / LHP 等） |
| 完成 XP | 路線自訂（見下表） | 全程所有站點均已到達 |
| 快速完成里程幣 | +5 🪙 | 在指定時限內完成全程 |

| 路線 | 完成 XP | 快速完成時限 | 站點數（每方向） | XP 上限 |
|------|--------|------------|----------------|--------|
| 900 | 200 XP | 45 分鐘 | ~16 站 | 450 XP |
| 900A | 150 XP | 30 分鐘 | 14 站 | 290 XP |
| 966T | 300 XP | 15 分鐘 | 2 站（無中途） | 300 XP |

---

## 版權聲明

&copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.

本專案僅供 CTRC HK 官方使用。
