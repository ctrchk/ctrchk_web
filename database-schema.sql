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

-- 初始路線配置（每3-4級解鎖一條新路線）
-- Level 1 起始路線：900, 900A, 966T（966T 取代 966 成為初始路線）
-- 里程幣解鎖路線：900S, 914B, 920, 961P, 962P, 962X（unlock_cost 為暫定值，待確認）
INSERT INTO routes_config (route_id, unlock_level, unlock_cost, xp_reward, is_special)
VALUES
  ('900',   1,  NULL, 450, false),  -- 20站：19站×10 XP（TIK 01除外不加XP）+ 3區段×20 XP + 200完成獎勵 = 最高450 XP
  ('900A',  1,  NULL, 360, false),  -- 15站：15站×10 XP + 3區段×20 XP + 150完成獎勵 = 最高360 XP
  ('966T',  1,  NULL, 320, false),  -- 2站（無中途站）：1區段×20 XP + 300完成獎勵 = 最高320 XP（初始路線，取代 966）
  ('914',   4,  NULL,  80, false),
  ('966A',  4,  NULL,  90, false),
  ('966',   4,  NULL, 110, false),  -- 已非初始路線，移至第4級
  ('910',   7,  NULL, 100, false),
  ('914B',  7,   500,  80, true),   -- 需要里程幣解鎖（暫定 500 幣）
  ('914H',  10, NULL,  80, false),
  ('920',   10,  800, 130, true),   -- 需要里程幣解鎖（暫定 800 幣）
  ('920X',  13, NULL, 100, false),
  ('900S',  13,  600, 130, true),   -- 需要里程幣解鎖（暫定 600 幣）
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
  -- Lv 1-5：新手騎士 / Rookie Rider
  (1,      0,    0,    '新手騎士', 'Rookie Rider'),
  (2,     80,   50,    '新手騎士', 'Rookie Rider'),
  (3,    200,   80,    '新手騎士', 'Rookie Rider'),
  (4,    380,  120,    '新手騎士', 'Rookie Rider'),
  (5,    620,  150,    '新手騎士', 'Rookie Rider'),
  -- Lv 6-10：城市騎手 / City Rider
  (6,    950,  200,    '城市騎手', 'City Rider'),
  (7,   1400,  250,    '城市騎手', 'City Rider'),
  (8,   1980,  300,    '城市騎手', 'City Rider'),
  (9,   2700,  350,    '城市騎手', 'City Rider'),
  (10,  3600,  400,    '城市騎手', 'City Rider'),
  -- Lv 11-15：路線達人 / Route Master（XP 要求已降低約 15%）
  (11,  4000,  500,    '路線達人', 'Route Master'),
  (12,  5100,  600,    '路線達人', 'Route Master'),
  (13,  6500,  700,    '路線達人', 'Route Master'),
  (14,  8100,  800,    '路線達人', 'Route Master'),
  (15, 10000,  900,    '路線達人', 'Route Master'),
  -- Lv 16-20：都市傳奇 / Urban Legend（XP 要求已降低約 15%）
  (16, 12200, 1000,    '都市傳奇', 'Urban Legend'),
  (17, 14800, 1200,    '都市傳奇', 'Urban Legend'),
  (18, 17800, 1400,    '都市傳奇', 'Urban Legend'),
  (19, 21200, 1600,    '都市傳奇', 'Urban Legend'),
  (20, 25200, 2000,    '都市傳奇', 'Urban Legend')
ON CONFLICT (level) DO UPDATE SET
  xp_required  = EXCLUDED.xp_required,
  coins_reward = EXCLUDED.coins_reward,
  title_zh     = EXCLUDED.title_zh,
  title_en     = EXCLUDED.title_en;

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
  ('level_5',         '城市騎手',       'City Rider',          '達到第5級',                          'Reach Level 5',                              '⭐', 0,   30, 'level', 5),
  ('level_10',        '路線達人',       'Route Master',        '達到第10級',                         'Reach Level 10',                             '🌟', 0,   80, 'level', 10),
  ('level_20',        '殿堂傳說',       'Hall of Legend',      '達到第20級',                         'Reach Level 20',                             '💫', 0,  200, 'level', 20),
  -- 路線完成
  ('route_900',       '海濱漫遊者',     'Coastal Wanderer',    '完成路線900（市區海濱線）',           'Complete Route 900 (Coastal Commuter)',       '🌊', 50,  20, 'route_complete', NULL),
  ('route_900_fast',  '海濱飛人',       'Coastal Sprinter',    '在45分鐘內完成路線900',              'Complete Route 900 within 45 minutes',       '⚡', 80,  30, 'route_complete', NULL),
  ('route_900_all',   '全站騎士',       'All Stops Rider',     '完成路線900的所有20個站點',          'Reach all 20 stops on Route 900',            '🗓️', 100, 40, 'stops_count', 20),
  -- 隱藏成就
  ('zone_changer',    '跨區達人',       'Zone Hopper',         '在一次騎行中完成所有3次區段切換',    'Cross all 3 zone boundaries in one ride',    '🔀', 60,  25, 'stops_count', NULL),
  ('night_rider',     '夜間騎手',       'Night Rider',         '在晚上10時至凌晨6時完成一次騎行',   'Complete a ride between 10pm and 6am',       '🌙', 40,  15, 'rides_count', NULL)
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
