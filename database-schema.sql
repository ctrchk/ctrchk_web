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
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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

COMMENT ON COLUMN users.user_role IS 'User membership tier: junior, senior, vip, admin, senior_admin';
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
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS stops_count INTEGER DEFAULT 0;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS all_stops BOOLEAN DEFAULT FALSE;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS districts_count INTEGER DEFAULT 0;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0; -- 此次騎行獲得的 XP
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS gpx_track TEXT;              -- 可選：實際騎行 GeoJSON
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web'; -- 'web' | 'pwa' | 'app'
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS anti_cheat BOOLEAN DEFAULT FALSE;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS anti_cheat_reason TEXT;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS random_bonus_xp INTEGER DEFAULT 0;
ALTER TABLE cycling_history ADD COLUMN IF NOT EXISTS random_bonus_coins INTEGER DEFAULT 0;

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
  mileage_km_365 DECIMAL(10,2) DEFAULT 0,
  mileage_rank   VARCHAR(10) DEFAULT 'bronze',
  commute_streak INTEGER DEFAULT 0,
  commute_streak_last_date DATE,
  commute_streak_pending INTEGER DEFAULT 0,
  commute_streak_pending_date DATE,
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS mileage_km_365 DECIMAL(10,2) DEFAULT 0;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS mileage_rank VARCHAR(10) DEFAULT 'bronze';
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak INTEGER DEFAULT 0;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_last_date DATE;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_pending INTEGER DEFAULT 0;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS commute_streak_pending_date DATE;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS total_saved_fare NUMERIC DEFAULT 0;

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
-- 遊戲化：用戶每日簽到記錄
-- =========================================================

CREATE TABLE IF NOT EXISTS user_daily_checkins (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  checkin_date  DATE NOT NULL,
  xp_earned     INTEGER DEFAULT 0,
  coins_earned  INTEGER DEFAULT 0,
  streak_day    INTEGER DEFAULT 1,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS user_reward_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_key VARCHAR(100) NOT NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, reward_key)
);

CREATE INDEX IF NOT EXISTS idx_user_reward_log_user_id ON user_reward_log(user_id);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    model_url_glb TEXT,
    model_url_usdz TEXT,
    tier VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- HK Challenges table
CREATE TABLE IF NOT EXISTS hk_challenges (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(50) NOT NULL, -- hk_30k, hk_60k, hk_100k
    route_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    xp_reward INTEGER DEFAULT 0,
    coin_reward INTEGER DEFAULT 0,
    multiplier NUMERIC(3,2) DEFAULT 1.00,
    multiplier_duration_days INTEGER DEFAULT 0,
    badge_id INTEGER REFERENCES badges(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Badges table
CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_checkins_user_id ON user_daily_checkins(user_id);

-- =========================================================
-- 遊戲化：路線解鎖條件配置
-- =========================================================

CREATE TABLE IF NOT EXISTS routes_config (
  route_id     VARCHAR(20) PRIMARY KEY,
  unlock_level INTEGER NOT NULL DEFAULT 1, -- 需要幾級才能騎行解鎖
  unlock_cost  INTEGER,                    -- NULL = 騎行解鎖；數字 = 里程幣購買
  promo_cost   INTEGER,                    -- NULL = 無優惠價；數字 = 優惠價
  xp_reward    INTEGER NOT NULL DEFAULT 100,
  is_special   BOOLEAN DEFAULT FALSE       -- TRUE = 只能購買，不能騎行解鎖
);
ALTER TABLE routes_config ADD COLUMN IF NOT EXISTS promo_cost INTEGER;

-- =========================================================
-- 站點與路線管理（Admin Dashboard 動態維護）
-- =========================================================

CREATE TABLE IF NOT EXISTS stations (
  id             VARCHAR(20) PRIMARY KEY, -- e.g. TKO01
  area           VARCHAR(20) NOT NULL,
  station_number INTEGER NOT NULL CHECK (station_number > 0),
  name_zh        VARCHAR(255) NOT NULL,
  name_en        VARCHAR(255),
  lat            DOUBLE PRECISION NOT NULL,
  lon            DOUBLE PRECISION NOT NULL,
  coordinates    POINT GENERATED ALWAYS AS (POINT(lon, lat)) STORED,
  road_name      VARCHAR(255),
  is_terminal    BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(area, station_number),
  CHECK (id = UPPER(area) || LPAD(station_number::TEXT, 2, '0'))
);

ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_terminal BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_stations_area ON stations(area);

CREATE TABLE IF NOT EXISTS routes (
  dept              VARCHAR(50) NOT NULL,
  route_number      VARCHAR(50) NOT NULL,
  start_station_id  VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
  end_station_id    VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('One-way', 'Two-way', 'Circular')),
  stops             JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewards           JSONB NOT NULL DEFAULT '{}'::jsonb,
  alias             VARCHAR(255),
  bg_color          VARCHAR(7),
  estimated_minutes INTEGER,
  unlock_type       VARCHAR(20) DEFAULT 'level',
  unlock_value      INTEGER,
  tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
  gpx               JSONB NOT NULL DEFAULT '[]'::jsonb,
  length_text       VARCHAR(32),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (dept, route_number)
);

ALTER TABLE routes ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS bg_color VARCHAR(7);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_type VARCHAR(20) DEFAULT 'level';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_value INTEGER;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS gpx JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS length_text VARCHAR(32);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_fare NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_routes_start_station ON routes(start_station_id);
CREATE INDEX IF NOT EXISTS idx_routes_end_station ON routes(end_station_id);

-- 初始路線配置（每3-4級解鎖一條新路線）
-- Level 1 起始路線：900, 900A, 966T（966T 取代 966 成為初始路線）
-- 里程幣解鎖路線：900S(300幣), 914B(200幣), 920, 961P, 962P, 962X（920/961P/962P/962X 幣數為暫定值，待確認）
INSERT INTO routes_config (route_id, unlock_level, unlock_cost, xp_reward, is_special)
VALUES
  ('900',   1,  NULL, 450, false),  -- 20站：19站×10 XP（TIK 01除外不加XP）+ 3區段×20 XP + 200完成獎勵 = 最高450 XP
  ('900A',  1,  NULL, 360, false),  -- 15站：15站×10 XP + 3區段×20 XP + 150完成獎勵 = 最高360 XP
  ('966T',  1,  NULL, 320, false),  -- 2站（無中途站）：1區段×20 XP + 300完成獎勵 = 最高320 XP（初始路線，取代 966）
  ('914',   4,  NULL,  80, false),
  ('914H',  4,  NULL, 170, false),  -- 4級解鎖，5站×10 XP + 120完成 = 最高170 XP
  ('966A',  4,  NULL,  90, false),
  ('966',   4,  NULL, 110, false),  -- 已非初始路線，移至第4級
  ('910',   5,  NULL, 260, false),  -- 5級解鎖，10站×10 XP + 160完成 = 最高260 XP
  ('914B',  1,   200, 290, true),   -- 200里程幣解鎖，9站×10 XP + 200完成 = 最高290 XP
  ('900S',  1,   300, 595, true),   -- 300里程幣解鎖，13站×15 XP + TKO-HAH區間100 + 300完成 = 最高595 XP
  ('920',   10,  800, 130, true),   -- 需要里程幣解鎖（暫定 800 幣）
  ('920X',  13, NULL, 100, false),
  ('901P',  16, NULL, 140, false),
  ('923',   16, NULL, 160, false),
  ('928',   19, NULL, 170, false),
  ('929',   19, NULL, 160, false),
  ('932',   20, NULL, 220, false),
  ('935',   20, NULL, 250, false),
  ('939',   20, NULL, 120, false),
  ('939M',  20, NULL, 120, false),
  ('955',   20, NULL, 110, false),
  ('955A',  20, NULL,  60, false),
  ('955H',  20, NULL,  80, false),
  ('961',   20, NULL, 130, false),
  ('961P',  20,  800, 100, true),   -- 需要里程幣解鎖（暫定 800 幣）
  ('962',   20, NULL, 250, false),
  ('962A',  20, NULL, 250, false),
  ('962P',  20, 1000, 150, true),   -- 需要里程幣解鎖（暫定 1000 幣）
  ('962X',  20, 1000, 130, true),   -- 需要里程幣解鎖（暫定 1000 幣）
  ('X935',  20, NULL, 210, false),
  ('960',   20, NULL, 400, false)
ON CONFLICT (route_id) DO UPDATE SET
  unlock_level = EXCLUDED.unlock_level,
  unlock_cost  = EXCLUDED.unlock_cost,
  xp_reward    = EXCLUDED.xp_reward,
  is_special   = EXCLUDED.is_special;

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
  -- Lv 1-5：入門車手 / Rookie Rider
  (1,      0,    0,    '入門車手', 'Rookie Rider'),
  (2,     80,   50,    '入門車手', 'Rookie Rider'),
  (3,    200,   80,    '入門車手', 'Rookie Rider'),
  (4,    380,  120,    '入門車手', 'Rookie Rider'),
  (5,    620,  150,    '入門車手', 'Rookie Rider'),
  -- Lv 6-10：初階車手 / City Rider
  (6,    950,  200,    '初階車手', 'City Rider'),
  (7,   1400,  250,    '初階車手', 'City Rider'),
  (8,   1980,  300,    '初階車手', 'City Rider'),
  (9,   2700,  350,    '初階車手', 'City Rider'),
  (10,  3600,  400,    '初階車手', 'City Rider'),
  -- Lv 6-15：初階車手 / Novice Rider
  (6,    950,  200,    '初階車手', 'Novice Rider'),
  (7,   1400,  250,    '初階車手', 'Novice Rider'),
  (8,   1980,  300,    '初階車手', 'Novice Rider'),
  (9,   2700,  350,    '初階車手', 'Novice Rider'),
  (10,  3600,  400,    '初階車手', 'Novice Rider'),
  (11,  4000,  500,    '初階車手', 'Novice Rider'),
  (12,  5100,  600,    '初階車手', 'Novice Rider'),
  (13,  6500,  700,    '初階車手', 'Novice Rider'),
  (14,  8100,  800,    '初階車手', 'Novice Rider'),
  (15, 10000,  900,    '初階車手', 'Novice Rider'),
  -- Lv 16-20：進階車手 / Intermediate Rider
  (16, 12200, 1000,    '進階車手', 'Intermediate Rider'),
  (17, 14800, 1200,    '進階車手', 'Intermediate Rider'),
  (18, 17800, 1400,    '進階車手', 'Intermediate Rider'),
  (19, 21200, 1600,    '進階車手', 'Intermediate Rider'),
  (20, 25200, 2000,    '進階車手', 'Intermediate Rider')
ON CONFLICT (level) DO UPDATE SET
  xp_required  = EXCLUDED.xp_required,
  coins_reward = EXCLUDED.coins_reward,
  title_zh     = EXCLUDED.title_zh,
  title_en     = EXCLUDED.title_en;

-- =========================================================
-- 管理員帳戶種子資料（使用 Google 登入）
-- ctrcz9829@gmail.com 預設為高級管理員，透過 Google OAuth 登入時
-- google_id 將自動由 api/google-auth.js 補上。
-- =========================================================

INSERT INTO users (email, user_role, full_name, profile_completed, auth_provider, email_verified)
VALUES ('ctrcz9829@gmail.com', 'senior_admin', 'CTRC HK 高級管理員', true, 'google', true)
ON CONFLICT (email) DO UPDATE
  SET user_role = 'senior_admin',
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

-- =========================================================
-- 每日 / 每週任務系統
-- =========================================================

CREATE TABLE IF NOT EXISTS task_definitions (
  id              SERIAL PRIMARY KEY,
  task_type       VARCHAR(10)  NOT NULL CHECK (task_type IN ('daily','weekly')),
  task_key        VARCHAR(50)  NOT NULL UNIQUE,
  title_zh        VARCHAR(100) NOT NULL,
  title_en        VARCHAR(100),
  description_zh  VARCHAR(255),
  description_en  VARCHAR(255),
  target_value    INTEGER      NOT NULL DEFAULT 1,  -- e.g. 1 ride, 5 km
  xp_reward       INTEGER      NOT NULL DEFAULT 0,
  coin_reward     INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_task_progress (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_key       VARCHAR(50) NOT NULL,
  period_date    DATE        NOT NULL,  -- daily: the day; weekly: the Monday of that week
  current_value  INTEGER     NOT NULL DEFAULT 0,
  completed      BOOLEAN     DEFAULT FALSE,
  completed_at   TIMESTAMP,
  reward_claimed BOOLEAN     DEFAULT FALSE,
  UNIQUE(user_id, task_key, period_date)
);

CREATE INDEX IF NOT EXISTS idx_user_task_progress_user_id    ON user_task_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_progress_period     ON user_task_progress(period_date);
CREATE INDEX IF NOT EXISTS idx_user_task_progress_task_key   ON user_task_progress(task_key);

-- 每日任務定義
INSERT INTO task_definitions (task_type, task_key, title_zh, title_en, description_zh, description_en, target_value, xp_reward, coin_reward)
VALUES
  ('daily', 'daily_ride_once',    '完成一次騎行',        'Complete One Ride',        '今日完成任意一條路線騎行',        'Complete any route ride today',         1, 20,  0),
  ('daily', 'daily_ride_5km',     '今日騎行達5公里',     'Ride 5 km Today',          '今日累計騎行距離達5公里',         'Accumulate 5 km of riding today',       5, 30,  5),
  ('daily', 'daily_reach_5stops', '到達5個站點',         'Reach 5 Stops',            '今日累計到達5個不同站點',         'Reach 5 different stops today',         5, 15,  0),
  ('daily', 'daily_route_900',    '騎行900線',           'Ride Route 900',           '完成900線（市區海濱線）的騎行',   'Complete a ride on Route 900',          1, 30, 10)
ON CONFLICT (task_key) DO UPDATE SET
  title_zh       = EXCLUDED.title_zh,
  title_en       = EXCLUDED.title_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  target_value   = EXCLUDED.target_value,
  xp_reward      = EXCLUDED.xp_reward,
  coin_reward    = EXCLUDED.coin_reward;

-- 每週任務定義
INSERT INTO task_definitions (task_type, task_key, title_zh, title_en, description_zh, description_en, target_value, xp_reward, coin_reward)
VALUES
  ('weekly', 'weekly_ride_3times',  '本週完成3次騎行',     'Complete 3 Rides This Week',   '本週完成任意3次路線騎行',         'Complete any 3 route rides this week',  3, 80,  20),
  ('weekly', 'weekly_ride_20km',    '本週騎行達20公里',    'Ride 20 km This Week',         '本週累計騎行距離達20公里',        'Accumulate 20 km of riding this week', 20, 100, 30),
  ('weekly', 'weekly_3routes',      '本週騎行3條不同路線', 'Ride 3 Different Routes',      '本週騎行至少3條不同路線',         'Ride at least 3 different routes',      3, 120, 40),
  ('weekly', 'weekly_45min_bonus',  '45分鐘內完成路線',    'Finish Route Within 45 Min',   '本週至少一次在45分鐘內完成路線', 'Finish any route within 45 minutes',    1, 50,  15)
ON CONFLICT (task_key) DO UPDATE SET
  title_zh       = EXCLUDED.title_zh,
  title_en       = EXCLUDED.title_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  target_value   = EXCLUDED.target_value,
  xp_reward      = EXCLUDED.xp_reward,
  coin_reward    = EXCLUDED.coin_reward;

-- =========================================================
-- 成就獎牌系統
-- =========================================================

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id              SERIAL PRIMARY KEY,
  ach_key         VARCHAR(50)  NOT NULL UNIQUE,
  title_zh        VARCHAR(100) NOT NULL,
  title_en        VARCHAR(100),
  description_zh  VARCHAR(255),
  description_en  VARCHAR(255),
  icon            VARCHAR(10)  DEFAULT '🏅',  -- emoji icon
  xp_reward       INTEGER      NOT NULL DEFAULT 0,
  coin_reward     INTEGER      NOT NULL DEFAULT 0,
  condition_type  VARCHAR(50),   -- 'rides_count' | 'distance_km' | 'level' | 'route_complete' | 'stops_count'
  condition_value INTEGER,       -- the threshold for the condition
  is_hidden       BOOLEAN      DEFAULT FALSE  -- hidden until achieved (secret achievements)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ach_key      VARCHAR(50) NOT NULL,
  achieved_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, ach_key)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_ach_key ON user_achievements(ach_key);

-- 成就獎牌定義
INSERT INTO achievement_definitions (ach_key, title_zh, title_en, description_zh, description_en, icon, xp_reward, coin_reward, condition_type, condition_value)
VALUES
  -- 騎行次數
  ('first_ride',      '初次出發',       'First Pedal',         '完成第一次騎行',                     'Complete your very first ride',              '🚲', 50,  10, 'rides_count', 1),
  ('rides_5',         '常客',           'Regular Rider',       '累計完成5次騎行',                    'Complete 5 rides in total',                  '🥉', 30,  20, 'rides_count', 5),
  ('rides_20',        '資深騎手',       'Seasoned Cyclist',    '累計完成20次騎行',                   'Complete 20 rides in total',                 '🥈', 80,  50, 'rides_count', 20),
  ('rides_50',        '鐵腿達人',       'Iron Legs',           '累計完成50次騎行',                   'Complete 50 rides in total',                 '🥇', 200, 100, 'rides_count', 50),
  -- 里程
  ('dist_50km',       '半百里程',       '50 km Club',          '累計騎行距離達50公里',               'Accumulate 50 km of riding',                 '📍', 50,  20, 'distance_km', 50),
  ('dist_200km',      '城市探索者',     'City Explorer',       '累計騎行距離達200公里',              'Accumulate 200 km of riding',                '🗺️', 150, 60, 'distance_km', 200),
  ('dist_500km',      '將軍澳傳奇',     'TKO Legend',          '累計騎行距離達500公里',              'Accumulate 500 km of riding',                '🏆', 400, 150, 'distance_km', 500),
  -- 等級
  ('level_5',         '初階車手',       'City Rider',          '達到第5級',                          'Reach Level 5',                              '⭐', 0,   30, 'level', 5),
  ('level_10',        '進階車手',       'Route Master',        '達到第10級',                         'Reach Level 10',                             '🌟', 0,   80, 'level', 10),
  ('level_20',        '殿堂傳說',       'Hall of Legend',      '達到第20級',                         'Reach Level 20',                             '💫', 0,  200, 'level', 20),
  -- 路線完成
  ('route_900',       '海濱漫遊者',     'Coastal Wanderer',    '完成路線900（市區海濱線）',           'Complete Route 900 (Coastal Commuter)',       '🌊', 50,  20, 'route_complete', NULL),
  ('route_900_fast',  '海濱飛人',       'Coastal Sprinter',    '在45分鐘內完成路線900',              'Complete Route 900 within 45 minutes',       '⚡', 80,  30, 'route_complete', NULL),
  ('route_900_all',   '全站騎士',       'All Stops Rider',     '完成路線900的所有20個站點',          'Reach all 20 stops on Route 900',            '🗓️', 100, 40, 'stops_count', 20),
  -- 隱藏成就
  ('zone_changer',    '跨區達人',       'Zone Hopper',         '在一次騎行中完成所有3次區段切換',    'Cross all 3 zone boundaries in one ride',    '🔀', 60,  25, 'stops_count', NULL),
  ('night_rider',     '夜間騎手',       'Night Rider',         '在晚上10時至凌晨6時完成一次騎行',   'Complete a ride between 10pm and 6am',       '🌙', 40,  15, 'rides_count', NULL),
  ('hk_challenge',    '全港挑戰王',     'HK Challenge Master',  '完成一條全港挑戰部的超長路線或多條指定路線', 'Complete an ultra-long route or specified routes in HK Challenge Dept', '👑', 2000, 500, 'route_complete', NULL)
ON CONFLICT (ach_key) DO UPDATE SET
  title_zh       = EXCLUDED.title_zh,
  title_en       = EXCLUDED.title_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  icon           = EXCLUDED.icon,
  xp_reward      = EXCLUDED.xp_reward,
  coin_reward    = EXCLUDED.coin_reward,
  condition_type = EXCLUDED.condition_type,
  condition_value= EXCLUDED.condition_value;

-- ── Web Push 推送通知訂閱 ─────────────────────────────────────────────────
-- 儲存瀏覽器的 Web Push 訂閱資訊，供伺服器推送通知使用。
-- user_id 可為 NULL（未登入的訪客也可訂閱提醒）。
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT,
  auth       TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- =========================================================
-- 用戶聊天訊息表
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender   ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));

-- =========================================================
-- 客服模式：支援 claim/lock 的工單（Support Threads）
-- =========================================================

CREATE TABLE IF NOT EXISTS support_threads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open | claimed | closed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_threads_user_id ON support_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_claimed_admin ON support_threads(claimed_by_admin_id);

-- 客服訊息：使用既有 chat_messages 表，但額外加 thread_id 來把客服記錄串起
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES support_threads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);

-- =========================================================
-- 好友系統
-- =========================================================

CREATE TABLE IF NOT EXISTS user_friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | declined | blocked
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_status ON user_friends(status);

-- =========================================================
-- 多人騎行房間系統
-- =========================================================

CREATE TABLE IF NOT EXISTS ride_rooms (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id VARCHAR(20),
    dir_index INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting | started | closed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES ride_rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_ready BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_rooms_code ON ride_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
