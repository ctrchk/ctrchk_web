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
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS route_id VARCHAR(20);
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS avg_speed_kmh DECIMAL(5,2);
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS stops_reached JSONB;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS gpx_track TEXT;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
  CREATE TABLE IF NOT EXISTS user_game_profile (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS routes_config (
    route_id VARCHAR(20) PRIMARY KEY,
    unlock_level INTEGER NOT NULL DEFAULT 1,
    unlock_cost INTEGER,
    xp_reward INTEGER NOT NULL DEFAULT 100,
    is_special BOOLEAN DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS level_config (
    level INTEGER PRIMARY KEY,
    xp_required INTEGER NOT NULL,
    coins_reward INTEGER DEFAULT 0,
    title_zh VARCHAR(50),
    title_en VARCHAR(50)
  );
  CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT,
    image_url TEXT,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS forum_topics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    tag VARCHAR(20),
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS forum_replies (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES forum_topics(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS forum_reactions (
    id SERIAL PRIMARY KEY,
    reply_id INTEGER REFERENCES forum_replies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(reply_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
  CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
  CREATE INDEX IF NOT EXISTS idx_cycling_history_user_id ON cycling_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_cycling_history_route_id ON cycling_history(route_id);
  CREATE INDEX IF NOT EXISTS idx_forum_topics_tag ON forum_topics(tag);
  CREATE INDEX IF NOT EXISTS idx_forum_topics_user_id ON forum_topics(user_id);
  CREATE INDEX IF NOT EXISTS idx_forum_replies_topic_id ON forum_replies(topic_id);
  CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
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
