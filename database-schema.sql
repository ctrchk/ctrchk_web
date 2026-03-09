-- Database schema for CTRC HK authentication system
-- This script is idempotent and safe to re-run on an existing database.
--
-- Execution order:
--   1. CREATE TABLE IF NOT EXISTS  — creates tables on a fresh install (no-op if they already exist)
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS — adds any columns that are missing from an older schema
--   3. CREATE INDEX IF NOT EXISTS  — creates any missing indexes
--
-- Run this script whenever the schema changes to bring an existing database up to date.

-- =========================================================
-- 1. Create tables (safe to re-run; skipped if tables already exist)
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for Google OAuth users
    user_role VARCHAR(20) DEFAULT 'junior',
    full_name VARCHAR(100),
    phone VARCHAR(20),
    birthdate DATE,
    experience VARCHAR(20),
    bike_type VARCHAR(20),
    preferred_area TEXT, -- 逗號分隔的多選地區
    profile_completed BOOLEAN DEFAULT FALSE,
    profile_completion_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    auth_provider VARCHAR(20) DEFAULT 'email',
    google_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expiry TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_token_expiry TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cycling_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ride_date DATE NOT NULL,
    distance_km DECIMAL(10, 2),
    route_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================
-- 2. Add missing columns to existing tables (migration)
--    These are no-ops when the column already exists.
-- =========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'junior';
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bike_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_area TEXT; -- Supports comma-separated list of areas
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completion_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email'; -- 'email' or 'google'
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255); -- Google user ID for OAuth users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;

-- =========================================================
-- 3. Create indexes (safe to re-run; skipped if they already exist)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_cycling_history_user_id ON cycling_history(user_id);
CREATE INDEX IF NOT EXISTS idx_cycling_history_ride_date ON cycling_history(ride_date);

-- =========================================================
-- Column descriptions
-- =========================================================

COMMENT ON COLUMN users.user_role IS 'User membership tier: junior (initial), senior (completed profile), admin (administrator)';
COMMENT ON COLUMN users.preferred_area IS 'Comma-separated list of preferred cycling areas';

-- =========================================================
-- 騎行歷史擴充欄位（為 PWA 騎行記錄及遊戲化功能準備）
-- =========================================================

ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS route_id VARCHAR(20);
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS avg_speed_kmh DECIMAL(5,2);
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS stops_reached JSONB;        -- 已到達的站點列表（例如 [1,2,3]）
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0; -- 此次騎行獲得的 XP
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS gpx_track TEXT;              -- 可選：實際騎行 GeoJSON
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web'; -- 'web' | 'pwa' | 'app'

CREATE INDEX IF NOT EXISTS idx_cycling_history_route_id ON cycling_history(route_id);
CREATE INDEX IF NOT EXISTS idx_cycling_history_start_time ON cycling_history(start_time);

-- =========================================================
-- 遊戲化：用戶遊戲進度資料表
-- =========================================================

CREATE TABLE IF NOT EXISTS user_game_profile (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level       INTEGER NOT NULL DEFAULT 1,
  xp          INTEGER NOT NULL DEFAULT 0,
  coins       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- =========================================================
-- 遊戲化：用戶已解鎖路線
-- =========================================================

CREATE TABLE IF NOT EXISTS user_unlocked_routes (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  route_id      VARCHAR(20) NOT NULL,
  unlock_method VARCHAR(20) NOT NULL DEFAULT 'default', -- 'level_up' | 'purchase' | 'default'
  unlocked_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

-- =========================================================
-- 遊戲化：路線解鎖條件配置
-- =========================================================

CREATE TABLE IF NOT EXISTS routes_config (
  route_id     VARCHAR(20) PRIMARY KEY,
  unlock_level INTEGER NOT NULL DEFAULT 1, -- 需要幾級才能騎行解鎖
  unlock_cost  INTEGER,                    -- NULL = 騎行解鎖；數字 = 里程幣購買
  xp_reward    INTEGER NOT NULL DEFAULT 100,
  is_special   BOOLEAN DEFAULT FALSE       -- TRUE = 只能購買，不能騎行解鎖
);

-- 初始路線配置（與 routes.json 同步）
INSERT INTO routes_config (route_id, unlock_level, unlock_cost, xp_reward, is_special)
VALUES
  ('900',   1, NULL, 150, false),
  ('900A',  1, NULL, 120, false),
  ('914',   1, NULL,  50, false),
  ('910',   2, NULL, 100, false),
  ('914B',  2, NULL,  80, false),
  ('914H',  2, NULL,  60, false),
  ('920',   2, NULL, 130, false),
  ('920X',  3, NULL, 100, false),
  ('900S',  3, NULL, 130, false),
  ('901P',  3, NULL, 140, false),
  ('923',   3, NULL, 160, false),
  ('928',   3, NULL, 170, false),
  ('929',   3, NULL, 160, false),
  ('955',   4, NULL, 110, false),
  ('955A',  4, NULL,  60, false),
  ('955H',  4, NULL,  80, false),
  ('932',   4, NULL, 220, false),
  ('935',   4, NULL, 250, false),
  ('939',   4, NULL, 120, false),
  ('939M',  4, NULL, 120, false),
  ('961',   4, NULL, 130, false),
  ('961P',  5, NULL, 100, false),
  ('962',   5, NULL, 250, false),
  ('962A',  5, NULL, 250, false),
  ('962P',  5, NULL, 150, false),
  ('962X',  5, NULL, 130, false),
  ('966',   5, NULL, 110, false),
  ('966A',  5, NULL,  90, false),
  ('X935',  5, NULL, 210, false),
  ('960',   5, NULL, 400, false)
ON CONFLICT (route_id) DO NOTHING;

-- =========================================================
-- 遊戲化：等級配置
-- =========================================================

CREATE TABLE IF NOT EXISTS level_config (
  level         INTEGER PRIMARY KEY,
  xp_required   INTEGER NOT NULL,
  coins_reward  INTEGER DEFAULT 0,
  title_zh      VARCHAR(50),
  title_en      VARCHAR(50)
);

INSERT INTO level_config (level, xp_required, coins_reward, title_zh, title_en)
VALUES
  (1,    0,    0,    '新手騎士',   'Rookie Rider'),
  (2,    300,  100,  '街坊騎手',   'Neighborhood Cyclist'),
  (3,    700,  200,  '區域探索者', 'Area Explorer'),
  (4,    1200, 300,  '城市達人',   'City Enthusiast'),
  (5,    1800, 500,  '城市騎士',   'City Rider'),
  (6,    2600, 600,  '路線通',     'Route Master'),
  (7,    3500, 700,  '將軍澳通',   'TKO Expert'),
  (8,    4500, 800,  '單車俠',     'Cycling Hero'),
  (9,    5800, 900,  '海濱傳奇',   'Waterfront Legend'),
  (10,   7500, 1000, '都市傳奇',   'Urban Legend')
ON CONFLICT (level) DO NOTHING;

-- =========================================================
-- 管理員帳戶種子資料（使用 Google 登入）
-- ctrcz9829@gmail.com 預設為管理員，透過 Google OAuth 登入時
-- google_id 將自動由 api/google-auth.js 補上。
-- =========================================================

INSERT INTO users (email, user_role, full_name, profile_completed, auth_provider, email_verified)
VALUES ('ctrcz9829@gmail.com', 'admin', 'CTRC HK 管理員', true, 'google', true)
ON CONFLICT (email) DO UPDATE
  SET user_role = 'admin',
      email_verified = true,
      profile_completed = true,
      auth_provider = 'google';

-- =========================================================
-- admin@ctrchk.com 管理員帳戶（使用電郵/密碼登入）
-- 此帳戶的 password_hash 為 NULL；首次登入前請透過「忘記密碼」
-- 功能或直接以 SQL 設置密碼：
--   UPDATE users SET password_hash = crypt('your_password', gen_salt('bf',12))
--     WHERE email = 'admin@ctrchk.com';
-- =========================================================

INSERT INTO users (email, user_role, full_name, profile_completed, auth_provider, email_verified)
VALUES ('admin@ctrchk.com', 'admin', 'CTRC HK Admin', true, 'email', true)
ON CONFLICT (email) DO UPDATE
  SET user_role = 'admin',
      email_verified = true,
      profile_completed = true;

-- =========================================================
-- 網誌文章（管理員可透過後台編寫）
-- =========================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  summary    TEXT,
  content    TEXT,
  image_url  TEXT,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);

-- =========================================================
-- 討論區（論壇）
-- =========================================================

CREATE TABLE IF NOT EXISTS forum_topics (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(100) NOT NULL,
  content    TEXT NOT NULL,
  tag        VARCHAR(20),   -- '路線討論' | '車站討論' | '地點討論' | NULL
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id         SERIAL PRIMARY KEY,
  topic_id   INTEGER REFERENCES forum_topics(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_reactions (
  id            SERIAL PRIMARY KEY,
  reply_id      INTEGER REFERENCES forum_replies(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) DEFAULT 'like',
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(reply_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_tag     ON forum_topics(tag);
CREATE INDEX IF NOT EXISTS idx_forum_topics_user_id ON forum_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_topic_id ON forum_replies(topic_id);

COMMENT ON COLUMN forum_topics.tag IS 'Discussion category: 路線討論 | 車站討論 | 地點討論 | NULL (no tag)';
