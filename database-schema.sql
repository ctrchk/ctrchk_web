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
    verification_token_expiry TIMESTAMP
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

-- =========================================================
-- 3. Create indexes (safe to re-run; skipped if they already exist)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_cycling_history_user_id ON cycling_history(user_id);
CREATE INDEX IF NOT EXISTS idx_cycling_history_ride_date ON cycling_history(ride_date);

-- =========================================================
-- Column descriptions
-- =========================================================

COMMENT ON COLUMN users.user_role IS 'User membership tier: junior (initial), senior (completed profile), admin (administrator)';
COMMENT ON COLUMN users.preferred_area IS 'Comma-separated list of preferred cycling areas';

-- =========================================================
-- 建立管理員帳戶（請修改 email、full_name 和 password_hash）
-- 使用 bcrypt 加密密碼，salt rounds = 12
-- 請在應用程式啟動後使用管理員後台的「新增管理員」功能建立管理員
-- 或直接執行以下 SQL（先將密碼hash替換為實際hash值）:
-- INSERT INTO users (email, password_hash, user_role, full_name, profile_completed, auth_provider, email_verified)
-- VALUES ('admin@ctrchk.com', '<bcrypt_hash_here>', 'admin', 'CTRC HK 管理員', true, 'email', true);
-- =========================================================
