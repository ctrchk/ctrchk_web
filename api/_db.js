// /api/_db.js
// 資料庫連接工具 — 支援 Vercel Postgres 或直接 Neon 連接字串
//
// 環境變數優先順序：
//   POSTGRES_URL          → 透過 Vercel Marketplace 整合 Neon 時自動設置
//   POSTGRES_PRISMA_URL   → Vercel Postgres 的 Prisma 連接字串（備用）
//   DATABASE_URL          → 直接使用 Neon 或其他 Postgres 時手動設置
//
// 💡 建議使用 DATABASE_URL，格式如：
//    postgresql://user:password@host/dbname?sslmode=require
import pkg from 'pg';
const { Pool } = pkg;

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    '❌ 找不到資料庫連接字串。請在環境變數中設置 POSTGRES_URL 或 DATABASE_URL。'
  );
}

const pool = new Pool({
  connectionString,
  // Neon 及多數雲端 Postgres 要求 SSL，但預設保留憑證驗證
  // 若您使用的是自簽憑證，可在連接字串後加上 ?sslmode=require
  ssl: connectionString ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 在模組載入時執行一次 schema 遷移，確保所有必要欄位都存在。
// 使用 IF NOT EXISTS 確保冪等性（可安全重複執行）。
// 這解決了 production 資料庫可能缺少 email_verified 等新增欄位的問題。
let _migrationError = null;
const schemaReady = pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    user_role VARCHAR(20) DEFAULT 'junior',
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
  );
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS birthdate DATE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(20);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS bike_type VARCHAR(20);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_area TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completion_date TIMESTAMP;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expiry TIMESTAMP;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;
  CREATE TABLE IF NOT EXISTS cycling_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ride_date DATE NOT NULL,
    distance_km DECIMAL(10, 2),
    route_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
  CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
`).catch(err => {
  // 記錄遷移錯誤但不阻斷後續查詢：
  // 若 production 資料庫已手動套用過 schema，後續查詢仍可正常執行。
  _migrationError = err;
  console.warn('Schema migration warning (columns may already exist):', err.message);
});

/**
 * 執行 SQL 查詢（參數化）
 * @param {string} text  SQL 語句，佔位符使用 $1, $2, ...
 * @param {Array}  params  對應的參數陣列
 */
export async function query(text, params) {
  await schemaReady; // 等待遷移嘗試完成（無論成功或失敗）
  if (_migrationError) {
    // 遷移失敗時仍嘗試執行查詢：若 schema 已由其他方式建立，查詢仍可成功
    console.warn('Proceeding with query despite migration warning:', _migrationError.message);
  }
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
