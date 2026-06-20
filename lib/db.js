// /lib/db.js
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
  connectionTimeoutMillis: 15000, // 增加到 15 秒以應對 Neon 冷啟動
});

// 在模組載入時執行一次 schema 遷移，確保所有必要欄位都存在。
// 使用 IF NOT EXISTS 確保冪等性（可安全重複執行）。
// 這解決了 production 資料庫可能缺少 email_verified 等新增欄位的問題。
let _migrationError = null;
let _migrationStarted = false;
let _schemaReadyPromise = null;

async function runMigrations() {
  if (_schemaReadyPromise) return _schemaReadyPromise;

  _migrationStarted = true;
  _schemaReadyPromise = pool.query(`
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
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(16);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id) WHERE discord_id IS NOT NULL;
  -- 為沒有 username 的舊有帳戶自動分配一個預設用戶名（可後續修改）
  UPDATE users SET username = CONCAT('user', CAST(id AS TEXT))
    WHERE username IS NULL OR LENGTH(TRIM(username)) = 0;
  CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON chat_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_unread ON chat_messages(receiver_id) WHERE is_read = FALSE;
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
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS stops_count INTEGER DEFAULT 0;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS all_stops BOOLEAN DEFAULT FALSE;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS districts_count INTEGER DEFAULT 0;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS gpx_track TEXT;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS anti_cheat BOOLEAN DEFAULT FALSE;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS anti_cheat_reason TEXT;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS random_bonus_xp INTEGER DEFAULT 0;
  ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS random_bonus_coins INTEGER DEFAULT 0;
  CREATE TABLE IF NOT EXISTS user_game_profile (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS mileage_km_365 DECIMAL(10,2) DEFAULT 0;
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS mileage_rank VARCHAR(10) DEFAULT 'bronze';
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak INTEGER DEFAULT 0;
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_last_date DATE;
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_pending INTEGER DEFAULT 0;
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_pending_date DATE;
  ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS total_saved_fare NUMERIC DEFAULT 0;
  CREATE TABLE IF NOT EXISTS user_unlocked_routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    route_id VARCHAR(20) NOT NULL,
    -- unlock_method: 'level_up' = earned by levelling up, 'purchase' = bought with coins, 'default' = starter route
    unlock_method VARCHAR(20) NOT NULL DEFAULT 'default',
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, route_id)
  );
  CREATE TABLE IF NOT EXISTS routes_config (
    route_id VARCHAR(20) PRIMARY KEY,
    unlock_level INTEGER NOT NULL DEFAULT 1,
    unlock_cost INTEGER,
    promo_cost INTEGER,
    xp_reward INTEGER NOT NULL DEFAULT 100,
    is_special BOOLEAN DEFAULT FALSE
  );
  ALTER TABLE routes_config ADD COLUMN IF NOT EXISTS promo_cost INTEGER;
  CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(20) PRIMARY KEY,
    area VARCHAR(20) NOT NULL,
    station_number INTEGER NOT NULL CHECK (station_number > 0),
    name_zh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    coordinates POINT GENERATED ALWAYS AS (POINT(lon, lat)) STORED,
    road_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(area, station_number),
    CHECK (id = UPPER(area) || LPAD(station_number::TEXT, 2, '0'))
  );
  ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_terminal BOOLEAN DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS idx_stations_area ON stations(area);
  CREATE TABLE IF NOT EXISTS routes (
    dept VARCHAR(50) NOT NULL,
    route_number VARCHAR(50) NOT NULL,
    start_station_id VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
    end_station_id VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('One-way', 'Two-way', 'Circular')),
    stops JSONB NOT NULL DEFAULT '[]'::jsonb,
    rewards JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (dept, route_number)
  );
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS bg_color VARCHAR(7);
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_type VARCHAR(20) DEFAULT 'level';
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_value INTEGER;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_fare NUMERIC DEFAULT 0;
  CREATE INDEX IF NOT EXISTS idx_routes_start_station ON routes(start_station_id);
  CREATE INDEX IF NOT EXISTS idx_routes_end_station ON routes(end_station_id);
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
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT,
    auth       TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS user_daily_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    xp_earned INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    streak_day INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, checkin_date)
  );
  CREATE TABLE IF NOT EXISTS user_reward_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_key VARCHAR(100) NOT NULL,
    granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, reward_key)
  );
  CREATE INDEX IF NOT EXISTS idx_user_daily_checkins_user_id ON user_daily_checkins(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_reward_log_user_id ON user_reward_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users ((LOWER(username))) WHERE username IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
  CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
  CREATE INDEX IF NOT EXISTS idx_cycling_history_user_id ON cycling_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_cycling_history_route_id ON cycling_history(route_id);
  CREATE INDEX IF NOT EXISTS idx_forum_topics_tag ON forum_topics(tag);
  CREATE INDEX IF NOT EXISTS idx_forum_topics_user_id ON forum_topics(user_id);
  CREATE INDEX IF NOT EXISTS idx_forum_replies_topic_id ON forum_replies(topic_id);
  CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
  CREATE TABLE IF NOT EXISTS department_config (
    dept_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unlock_cost INTEGER NOT NULL DEFAULT 400,
    promo_cost INTEGER,
    is_promo BOOLEAN DEFAULT FALSE,
    promo_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS region VARCHAR(100);
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION;
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_center_lng DOUBLE PRECISION;
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_zoom INTEGER;
  ALTER TABLE department_config ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;
  CREATE TABLE IF NOT EXISTS user_unlocked_departments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    dept_id VARCHAR(20) NOT NULL,
    unlock_method VARCHAR(20) DEFAULT 'purchase',
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, dept_id)
  );
  CREATE TABLE IF NOT EXISTS active_rides (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ride_type VARCHAR(20) NOT NULL DEFAULT 'route',
    state JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, ride_type)
  );

  -- 路線解鎖配置種子資料（Level 1 起始路線：900, 900A, 966T）
  INSERT INTO routes_config (route_id, unlock_level, unlock_cost, xp_reward, is_special) VALUES
    ('900',   1,  NULL, 150, false),('900A',  1,  NULL, 120, false),('966T',  1,  NULL,  90, false),
    ('914',   4,  NULL,  80, false),('966A',  4,  NULL,  90, false),('966',   4,  NULL, 110, false),
    ('910',   5,  NULL, 260, false),
    -- 914B 需要里程幣解鎖（200 幣）
    ('914B',  1,   200, 290, true),
    ('914H',  4,  NULL, 170, false),
    -- 920 需要里程幣解鎖（暫定 800 幣，待確認）
    ('920',   10,  800, 130, true),
    ('920X',  13, NULL, 100, false),
    -- 900S 需要里程幣解鎖（300 幣）
    ('900S',  1,   300, 595, true),
    ('901P',  16, NULL, 140, false),('923',   16, NULL, 160, false),
    ('928',   19, NULL, 170, false),('929',   19, NULL, 160, false),
    ('932',   20, NULL, 220, false),('935',   20, NULL, 250, false),
    ('939',   20, NULL, 120, false),('939M',  20, NULL, 120, false),
    ('955',   20, NULL, 110, false),('955A',  20, NULL,  60, false),
    ('955H',  20, NULL,  80, false),('961',   20, NULL, 130, false),
    -- 961P 需要里程幣解鎖（暫定 800 幣，待確認）
    ('961P',  20,  800, 100, true),
    ('962',   20, NULL, 250, false),('962A',  20, NULL, 250, false),
    -- 962P 需要里程幣解鎖（暫定 1000 幣，待確認）
    ('962P',  20, 1000, 150, true),
    -- 962X 需要里程幣解鎖（暫定 1000 幣，待確認）
    ('962X',  20, 1000, 130, true),
    ('X935',  20, NULL, 210, false),('960',   20, NULL, 400, false),
    -- 港島海濱部路線（7E, 7W — 解鎖部門後免費騎行；完成獎勵 150 XP + 5 里程幣，無到站 XP）
    ('7E', 1, NULL, 150, false),
    ('7W', 1, NULL, 150, false),
    -- 全港挑戰部：超長路線 999 範例
    ('999', 30, NULL, 2000, false)
  ON CONFLICT (route_id) DO UPDATE SET
    unlock_level = EXCLUDED.unlock_level,
    unlock_cost  = EXCLUDED.unlock_cost,
    xp_reward    = EXCLUDED.xp_reward,
    is_special   = EXCLUDED.is_special;

  INSERT INTO department_config (dept_id, name, region, description, map_center_lat, map_center_lng, map_zoom, available, unlock_cost, promo_cost, is_promo) VALUES
    ('tko', '將軍澳部', '西貢區', '將軍澳全區單車路線，包括寶琳、坑口、調景嶺等', 22.308, 114.262, 13, TRUE, 0, NULL, FALSE),
    ('hki', '港島海濱部', '東區', '港島北岸各海濱單車路線，包括北角東岸板道等', 22.293, 114.201, 15, TRUE, 400, 20, TRUE),
    ('st', '沙田部', '沙田區', '沙田區單車路線（規劃中）', 22.382, 114.188, 13, FALSE, 400, NULL, FALSE),
    ('challenge', '全港挑戰部', '全香港', '挑戰極限！完成長途路線以獲得巨額獎勵及專屬徽章', 22.3193, 114.1694, 11, TRUE, 0, NULL, FALSE)
  ON CONFLICT (dept_id) DO UPDATE SET
    region = EXCLUDED.region,
    description = EXCLUDED.description,
    map_center_lat = EXCLUDED.map_center_lat,
    map_center_lng = EXCLUDED.map_center_lng,
    map_zoom = EXCLUDED.map_zoom,
    available = EXCLUDED.available,
    unlock_cost = EXCLUDED.unlock_cost,
    promo_cost = EXCLUDED.promo_cost,
    is_promo = EXCLUDED.is_promo;

  -- 等級配置種子資料（20 級，每5級更換稱號，後期升級要求已適當降低）
  INSERT INTO level_config (level, xp_required, coins_reward, title_zh, title_en) VALUES
    (1,      0,    0, '入門車手', 'Rookie Rider'),
    (2,     80,   50, '入門車手', 'Rookie Rider'),
    (3,    200,   80, '入門車手', 'Rookie Rider'),
    (4,    380,  120, '入門車手', 'Rookie Rider'),
    (5,    620,  150, '入門車手', 'Rookie Rider'),
    (6,    950,  200, '初階車手', 'City Rider'),
    (7,   1400,  250, '初階車手', 'City Rider'),
    (8,   1980,  300, '初階車手', 'City Rider'),
    (9,   2700,  350, '初階車手', 'City Rider'),
    (10,  3600,  400, '初階車手', 'City Rider'),
    (11,  4000,  500, '初階車手', 'Novice Rider'),
    (12,  5100,  600, '初階車手', 'Novice Rider'),
    (13,  6500,  700, '初階車手', 'Novice Rider'),
    (14,  8100,  800, '初階車手', 'Novice Rider'),
    (15, 10000,  900, '初階車手', 'Novice Rider'),
    (16, 12200, 1000, '進階車手', 'Intermediate Rider'),
    (17, 14800, 1200, '進階車手', 'Intermediate Rider'),
    (18, 17800, 1400, '進階車手', 'Intermediate Rider'),
    (19, 21200, 1600, '進階車手', 'Intermediate Rider'),
    (20, 25200, 2000, '進階車手', 'Intermediate Rider')
  ON CONFLICT (level) DO UPDATE SET
    xp_required  = EXCLUDED.xp_required,
    coins_reward = EXCLUDED.coins_reward,
    title_zh     = EXCLUDED.title_zh,
    title_en     = EXCLUDED.title_en;
`).catch(err => {
  _migrationError = err;
  console.warn('Schema migration warning (columns may already exist):', err.message);
});
  return _schemaReadyPromise;
}

/**
 * 執行 SQL 查詢（參數化）
 * @param {string} text  SQL 語句，佔位符使用 $1, $2, ...
 * @param {Array}  params  對應的參數陣列
 */
export async function query(text, params) {
  // 只有在明確要求時才執行並等待 Schema 遷移，避免在 Webhook 高壓環境下阻塞
  if (process.env.RUN_MIGRATIONS === 'true') {
    await runMigrations();
    if (_migrationError) {
      console.warn('Proceeding with query despite migration warning:', _migrationError.message);
    }
  }

  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
