ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS xp_multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS multiplier_expiry TIMESTAMP;
ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS catalog_reward_claimed BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    model_url_glb TEXT,
    model_url_usdz TEXT,
    image_url TEXT,
    tier VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    badge_id INTEGER REFERENCES badges(id),
    awarded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS hk_challenges (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(20),
    route_id VARCHAR(50),
    name VARCHAR(255),
    xp_reward INTEGER,
    coin_reward INTEGER,
    badge_id INTEGER REFERENCES badges(id),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ride_invitations (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    room_code VARCHAR(10),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
