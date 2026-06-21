// /api/user.js
// Consolidated user profile endpoint.
//
//   GET  /api/user?user_id=X   → get user info (replaces get-user.js)
//   GET  /api/user?google_id=X → get user by Google ID
//   GET  /api/user?email=X     → get user by email
//   POST /api/user             → update profile (replaces update-profile.js)
//
import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';
import { buildPermissionContext, MILEAGE_RANK_LABELS, normalizeMileageRank } from '../lib/permissions.js';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

let _ensureUsersUsernameColumnPromise = null;
async function ensureUsersUsernameColumn() {
  if (!_ensureUsersUsernameColumnPromise) {
    _ensureUsersUsernameColumnPromise = (async () => {
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(16);');
      await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users ((LOWER(username))) WHERE username IS NOT NULL;');
    })().catch((err) => {
      _ensureUsersUsernameColumnPromise = null;
      throw err;
    });
  }
  await _ensureUsersUsernameColumnPromise;
}

let _ensureRideTablesPromise = null;
async function ensureRideTables() {
  if (!_ensureRideTablesPromise) {
    _ensureRideTablesPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS user_friends (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          friend_id INTEGER REFERENCES users(id),
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, friend_id)
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS active_rides (
          user_id INTEGER REFERENCES users(id),
          ride_type VARCHAR(20),
          state JSONB,
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (user_id, ride_type)
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS ride_rooms (
          id SERIAL PRIMARY KEY,
          room_code VARCHAR(10) UNIQUE,
          host_id INTEGER REFERENCES users(id),
          route_id VARCHAR(50),
          dir_index INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'waiting',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS room_members (
          id SERIAL PRIMARY KEY,
          room_id INTEGER REFERENCES ride_rooms(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id),
          is_ready BOOLEAN DEFAULT FALSE,
          joined_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(room_id, user_id)
        );
      `);
    })().catch(err => {
      _ensureRideTablesPromise = null;
      throw err;
    });
  }
  await _ensureRideTablesPromise;
}

function getCyclistTierByLevel(level) {
  const lv = Number(level || 1);
  if (lv >= 76) return '頂尖車手';
  if (lv >= 51) return '精英車手';
  if (lv >= 31) return '資深車手';
  if (lv >= 16) return '進階車手';
  if (lv >= 6) return '初階車手';
  return '入門車手';
}

function getMileageCardByRank(rankKey) {
  return MILEAGE_RANK_LABELS[normalizeMileageRank(rankKey)] || '銅卡';
}

function getMembershipLabel(role) {
  const map = {
    junior: '普通會員',
    senior: '高級會員',
    vip: 'VIP 會員',
    admin: '管理員',
    senior_admin: '高級管理員',
  };
  return map[role] || role || '普通會員';
}

function normalizeDeptId(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return 'tko';
  if (['tko', 'tko部', 'tk', 'poa', 'hah', 'tik', 'lhp'].includes(raw)) return 'tko';
  if (['hki', 'hk', 'island', '港島', 'east'].includes(raw)) return 'hki';
  if (['st', 'shatin', '沙田'].includes(raw)) return 'st';
  if (['challenge', '全港挑戰', '挑戰', '全港挑戰部'].includes(raw)) return 'challenge';
  return raw;
}

function parseSafeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function authenticate(req, res, required = true) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (required) {
      res.status(401).json({ message: 'Authorization header missing or invalid' });
    }
    return null;
  }
  let token = authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    if (required) {
      res.status(401).json({ message: 'Token missing or invalid' });
    }
    return null;
  }
  // Remove possible quotes from client-side localStorage.getItem mishap
  token = token.replace(/^["'](.+(?=["']$))["']$/, '$1');

  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    if (required) {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET → public route metadata (for app route list) ────────────────────
  if (req.method === 'GET' && req.query.action === 'route-data') {
    try {
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS alias VARCHAR(255)`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS bg_color VARCHAR(7)`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_type VARCHAR(20) DEFAULT 'level'`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_value INTEGER`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS gpx JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS stops JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS length_text VARCHAR(32)`);
      await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_fare NUMERIC DEFAULT 0`);
      await query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_terminal BOOLEAN DEFAULT FALSE`);

      const [
        { rows: routes },
        { rows: stations },
        { rows: departments },
        { rows: bigDataStats }
      ] = await Promise.all([
        query(
          `SELECT dept, route_number, alias, bg_color, estimated_minutes, unlock_type, unlock_value, tags, gpx, length_text, stops, rewards, route_fare
           FROM routes
           ORDER BY dept, route_number`
        ),
        query(
          `SELECT id, area, station_number, name_zh, name_en, lat, lon, road_name, is_terminal
           FROM stations`
        ),
        query(
          `SELECT dept_id, name, region, description, map_center_lat, map_center_lng, map_zoom, available, unlock_cost, promo_cost, is_promo
           FROM department_config
           ORDER BY dept_id`
        ),
        query(
          `SELECT route_id, COUNT(*) as ride_count, AVG(duration_minutes) as avg_duration
           FROM cycling_history
           WHERE route_id IS NOT NULL AND duration_minutes > 0
           GROUP BY route_id`
        )
      ]);

      const stationMap = new Map();
      stations.forEach(s => stationMap.set(s.id, s));

      const terminals = stations.filter(s => s.is_terminal).map(t => ({
        id: t.id,
        name: t.name_zh,
        lat: t.lat,
        lng: t.lon,
        dept: normalizeDeptId(t.area),
      }));

      const statsMap = new Map();
      bigDataStats.forEach(s => statsMap.set(s.route_id, s));

      const resolvedRoutes = routes.map(r => {
        const fullId = `${r.dept}-${r.route_number}`;
        const stats = statsMap.get(fullId) || statsMap.get(r.route_number);

        let displayMinutes = r.estimated_minutes;
        if (stats && parseInt(stats.ride_count) >= 100) {
            displayMinutes = Math.round(parseFloat(stats.avg_duration));
        }

        let tags = [];
        if (Array.isArray(r.tags)) {
          tags = r.tags;
        } else if (r.tags) {
          try { tags = JSON.parse(r.tags); } catch (_) { tags = []; }
        }

        const rawStops = Array.isArray(r.stops) ? r.stops : parseSafeJsonArray(r.stops);
        const rewards = typeof r.rewards === 'object' ? r.rewards : parseSafeJsonArray(r.rewards) || {};
        const perStopXp = rewards.per_stop_xp || 0;

        const resolvedStops = rawStops.map((rs, idx) => {
          const st = stationMap.get(rs.station_id);
          if (!st) return null;

          let direction = '↕️';
          if (rs.nature === 'start') direction = '🔴';
          else if (rs.nature === 'end') direction = '🟢';
          else if (rs.nature === 'a_direction') direction = '⬆️';
          else if (rs.nature === 'b_direction') direction = '⬇️';
          else if (idx === 0) direction = '🔴';
          else if (idx === rawStops.length - 1) direction = '🟢';

          return {
            order: idx + 1,
            code: st.id,
            name: st.name_zh,
            name_en: st.name_en,
            road: st.road_name,
            direction: direction,
            nature: rs.nature || 'both',
            type: rs.type || 'standard',
            district: st.area,
            xp: perStopXp,
            lat: st.lat,
            lon: st.lon,
          };
        }).filter(Boolean);

        return {
          route_id: r.route_number,
          dept: r.dept,
          alias: r.alias,
          bg_color: r.bg_color,
          estimated_minutes: displayMinutes,
          unlock_type: r.unlock_type || 'level',
          unlock_value: r.unlock_value,
          tags,
          gpx: Array.isArray(r.gpx) ? r.gpx : parseSafeJsonArray(r.gpx),
          stops: resolvedStops,
          length_text: r.length_text || null,
          route_fare: parseFloat(r.route_fare || 0),
        };
      });

      return res.status(200).json({
        routes: resolvedRoutes,
        terminals: terminals,
        departments: departments.map(d => ({
            id: d.dept_id,
            name: d.name,
            region: d.region,
            description: d.description,
            mapCenter: [d.map_center_lat, d.map_center_lng],
            mapZoom: d.map_zoom,
            available: d.available,
            unlock_cost: d.unlock_cost,
            promo_cost: d.promo_cost,
            is_promo: d.is_promo
        })),
      });
    } catch (error) {
      console.error('Get route-data error:', error);
      return res.status(500).json({ message: 'Failed to fetch route data', routes: [], terminals: [] });
    }
  }

  // ── GET → fetch user info ───────────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'active-ride') {
    const userData = await authenticate(req, res);
    if (!userData) return;
    try {
      await ensureRideTables();
      const type = req.query.type || 'route';
      const { rows } = await query(
        `SELECT state, updated_at FROM active_rides
         WHERE user_id = $1 AND ride_type = $2 AND updated_at >= NOW() - INTERVAL '24 hours'`,
        [userData.userId, type]
      );
      if (rows.length > 0) {
          const state = rows[0].state;
          state.updated_at = rows[0].updated_at;
          return res.status(200).json({ state });
      }
      return res.status(200).json({ state: null });
    } catch (error) {
      console.error('[active-ride GET] error:', error);
      return res.status(500).json({ message: 'Failed to fetch active ride' });
    }
  }

  if (req.method === 'GET') {
    if (req.query.action === 'room-status') {
      const userData = await authenticate(req, res);
      if (!userData) return;
      try {
        await ensureRideTables();
        const { roomId } = req.query;
        if (!roomId) return res.status(400).json({ message: 'roomId required' });
        const { rows: roomRows } = await query(`SELECT status, route_id, dir_index FROM ride_rooms WHERE id = $1`, [roomId]);
        if (roomRows.length === 0) return res.status(404).json({ message: 'Room not found' });
        const { rows: memberRows } = await query(
          `SELECT u.username, m.is_ready
                 FROM room_members m
                 JOIN users u ON m.user_id = u.id
                 WHERE m.room_id = $1`,
          [roomId]
        );
        return res.status(200).json({
          status: roomRows[0]?.status,
          routeId: roomRows[0]?.route_id,
          dirIndex: roomRows[0]?.dir_index,
          members: memberRows
        });
      } catch (e) {
        return res.status(500).json({ message: e.message });
      }
    }
    if (req.query.action === 'friends') {
      // Allow if token is valid OR if user_id is provided (public view)
      const userData = await authenticate(req, res, false);
      if (!userData && !req.query.user_id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      try {
        await ensureRideTables();
        const user_id = parseInt(req.query.user_id || (userData ? userData.userId : null), 10);
        if (!user_id) return res.status(400).json({ message: 'user_id required' });

        const { rows } = await query(
          `SELECT u.id, u.username, u.full_name, u.avatar_url, uf.status,
                  gp.level, gp.xp, gp.coins, gp.mileage_rank, gp.mileage_km_365
           FROM user_friends uf
           JOIN users u ON u.id = CASE WHEN uf.user_id = $1 THEN uf.friend_id ELSE uf.user_id END
           LEFT JOIN user_game_profile gp ON gp.user_id = u.id
           WHERE (uf.user_id = $1 OR uf.friend_id = $1) AND uf.status = 'accepted'`,
          [user_id]
        );
        return res.status(200).json(rows);
      } catch (error) {
        console.error('Get friends error:', error);
        return res.status(500).json({ message: 'Failed to fetch friends' });
      }
    }

    if (req.query.action === 'friend_requests') {
      const userData = await authenticate(req, res, false);
      if (!userData && !req.query.user_id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      try {
        const user_id = parseInt(req.query.user_id || (userData ? userData.userId : null), 10);
        if (!user_id) return res.status(400).json({ message: 'user_id required' });

        const { rows } = await query(
          `SELECT u.id, u.username, u.full_name, u.avatar_url, uf.id as request_id,
                  gp.level, gp.xp, gp.mileage_rank
           FROM user_friends uf
           JOIN users u ON u.id = uf.user_id
           LEFT JOIN user_game_profile gp ON gp.user_id = u.id
           WHERE uf.friend_id = $1 AND uf.status = 'pending'`,
          [user_id]
        );
        return res.status(200).json(rows);
      } catch (error) {
        console.error('Get friend requests error:', error);
        return res.status(500).json({ message: 'Failed to fetch friend requests' });
      }
    }

    if (req.query.action === 'public-profile') {
      try {
        const user_id = parseInt(req.query.user_id, 10);
        if (isNaN(user_id)) return res.status(400).json({ message: 'user_id required' });

        const { rows } = await query(
          `SELECT u.username, u.full_name, u.avatar_url,
                  gp.level, gp.xp, gp.mileage_rank,
                  (SELECT SUM(ch.distance_km) FROM cycling_history ch WHERE ch.user_id = u.id) as total_distance_km
           FROM users u
           LEFT JOIN user_game_profile gp ON gp.user_id = u.id
           WHERE u.id = $1`,
          [user_id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        user.total_distance_km = Number(user.total_distance_km || 0);
        user.mileage_card = getMileageCardByRank(user.mileage_rank || 'bronze');
        user.cyclist_tier = getCyclistTierByLevel(user.level || 1);

        return res.status(200).json(user);
      } catch (error) {
        console.error('Get public-profile error:', error);
        return res.status(500).json({ message: 'Failed to fetch public profile' });
      }
    }

    if (req.query.action === 'gpx-list') {
      try {
        const gpxDir = path.join(process.cwd(), 'gpx');
        const files = (await readdir(gpxDir, { withFileTypes: true }))
          .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.gpx'))
          .map((d) => d.name)
          .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        return res.status(200).json({ files });
      } catch (error) {
        console.error('Get gpx-list error:', error);
        return res.status(500).json({ message: 'Failed to fetch gpx list', files: [] });
      }
    }

    // action=config → return public config (replaces config.js)
    if (req.query.action === 'config' || req.query.action === 'google-client-id') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        mapboxToken: process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiY3RyY2hrIiwiYSI6ImNtcHowaGF4cjBjYW8ydHB5dG1oMnl6cDMifQ.yEFQziumf4lLCa9W0H36qw'
      });
    }

    try {
      const { google_id, email, user_id } = req.query;

      if (!google_id && !email && !user_id) {
        return res.status(400).json({ message: 'User identifier required (google_id, email, or user_id)' });
      }

      let result;
      const SELECT = `SELECT u.id, u.email, u.username, u.user_role, u.full_name, u.phone, u.profile_completed,
                             u.auth_provider, u.created_at, u.email_verified, u.avatar_url,
                             gp.level, gp.xp, gp.coins, gp.mileage_rank, gp.mileage_km_365,
                             gp.commute_streak, gp.commute_streak_last_date, gp.commute_streak_pending,
                             gp.commute_streak_pending_date, gp.total_saved_fare,
                             COALESCE((SELECT SUM(ch.distance_km) FROM cycling_history ch WHERE ch.user_id = u.id), 0) AS total_distance_km,
                             COALESCE((SELECT SUM(ch.distance_km)
                                       FROM cycling_history ch
                                       WHERE ch.user_id = u.id
                                         AND ch.ride_date >= (CURRENT_DATE - INTERVAL '365 days')), 0) AS rolling_distance_km
                        FROM users u
                        LEFT JOIN user_game_profile gp ON gp.user_id = u.id`;

      if (google_id) {
        result = await query(`${SELECT} WHERE u.google_id = $1`, [google_id]);
      } else if (user_id) {
        result = await query(`${SELECT} WHERE u.id = $1`, [user_id]);
      } else {
        result = await query(`${SELECT} WHERE u.email = $1`, [email]);
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = result.rows[0];
      if (user.level === null || user.level === undefined) {
        user.level = 1;
        user.xp = 0;
        user.coins = 0;
      }
      user.total_distance_km = Number(user.total_distance_km || 0);
      const rollingKm = Number(user.rolling_distance_km || 0);
      const storedRank = normalizeMileageRank(user.mileage_rank || 'bronze');
      const storedMileageKm = Number(
        user.mileage_km_365 === null || user.mileage_km_365 === undefined
          ? rollingKm
          : user.mileage_km_365
      );
      user.mileage_rank = storedRank;
      user.mileage_km_365 = storedMileageKm;
      user.mileage_card = getMileageCardByRank(storedRank);
      user.mileage_rolling_km = rollingKm;
      user.cyclist_tier = getCyclistTierByLevel(user.level);
      user.membership_status = getMembershipLabel(user.user_role);

      const permContext = buildPermissionContext(storedRank);
      user.permissions = permContext.permissions;
      user.permission_rank = permContext.rank;

      // Fetch coin-purchased route IDs for the front-end unlock cache
      try {
        const { rows: unlockedRows } = await query(
          `SELECT route_id FROM user_unlocked_routes WHERE user_id = $1 AND unlock_method = 'purchase'`,
          [user.id]
        );
        user.unlocked_coin_routes = unlockedRows.map(r => r.route_id);
      } catch (e) {
        user.unlocked_coin_routes = [];
      }

      // Fetch conquered (completed) route IDs for the collection system
      try {
        const { rows: conqueredRows } = await query(
          `SELECT DISTINCT route_id FROM cycling_history WHERE user_id = $1 AND route_id IS NOT NULL`,
          [user.id]
        );
        user.conquered_route_ids = conqueredRows.map(r => r.route_id);
      } catch (e) {
        user.conquered_route_ids = [];
      }

      // Fetch unlocked department IDs
      try {
        const { rows: unlockedDeptRows } = await query(
          `SELECT dept_id FROM user_unlocked_departments WHERE user_id = $1`,
          [user.id]
        );
        user.unlocked_departments = unlockedDeptRows.map(r => r.dept_id);
      } catch(e) {
        user.unlocked_departments = [];
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── POST → update profile ───────────────────────────────────────────────
  if (req.method === 'POST' && req.body.action === 'active-ride') {
    const userData = await authenticate(req, res);
    if (!userData) return;
    try {
      await ensureRideTables();
      const { state, share_location } = req.body || {};
      if (!state) return res.status(400).json({ message: 'State is required' });
      const type = state.type || 'route';
      await query(
        `INSERT INTO active_rides (user_id, ride_type, state, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, ride_type) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
        [userData.userId, type, JSON.stringify(state)]
      );

      let friendsLocations = [];
      if (share_location && state.routeId) {
          // Fetch friends riding the SAME route
          const { rows } = await query(
              `SELECT ar.user_id, u.username,
                      (ar.state->>'lastLat')::double precision as lat,
                      (ar.state->>'lastLon')::double precision as lng
               FROM active_rides ar
               JOIN users u ON ar.user_id = u.id
               JOIN user_friends uf ON (uf.user_id = $1 AND uf.friend_id = ar.user_id)
                                    OR (uf.friend_id = $1 AND uf.user_id = ar.user_id)
               WHERE ar.ride_type = 'route'
                 AND ar.state->>'routeId' = $2
                 AND ar.user_id != $1
                 AND uf.status = 'accepted'
                 AND ar.updated_at >= NOW() - INTERVAL '5 minutes'`,
              [userData.userId, state.routeId]
          );
          friendsLocations = rows;
      }

      return res.status(200).json({ success: true, friends_locations: friendsLocations });
    } catch (error) {
      console.error('[active-ride POST] error:', error);
      return res.status(500).json({ message: 'Failed to sync active ride' });
    }
  }

  if (req.method === 'DELETE' && req.query.action === 'active-ride') {
    const userData = await authenticate(req, res);
    if (!userData) return;
    try {
      const type = req.query.type || 'route';
      await query('DELETE FROM active_rides WHERE user_id = $1 AND ride_type = $2', [userData.userId, type]);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[active-ride DELETE] error:', error);
      return res.status(500).json({ message: 'Failed to clear active ride' });
    }
  }

  if (req.method === 'POST') {
    if (req.body.action === 'create-room') {
        const userData = await authenticate(req, res);
        if (!userData) return;
        try {
            await ensureRideTables();
            const { routeId, dirIndex } = req.body;
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { rows } = await query(
                `INSERT INTO ride_rooms (room_code, host_id, route_id, dir_index)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [roomCode, userData.userId, routeId, dirIndex]
            );
            const roomId = rows[0].id;
            await query(
                `INSERT INTO room_members (room_id, user_id, is_ready) VALUES ($1, $2, TRUE)`,
                [roomId, userData.userId]
            );
            return res.status(200).json({ success: true, roomCode, roomId });
        } catch (e) {
            return res.status(500).json({ message: e.message });
        }
    }

    if (req.body.action === 'join-room') {
        const userData = await authenticate(req, res);
        if (!userData) return;
        try {
            await ensureRideTables();
            const { roomCode } = req.body;
            const { rows } = await query(
                `SELECT id, status, route_id, dir_index FROM ride_rooms WHERE room_code = $1 AND status = 'waiting'`,
                [roomCode]
            );
            if (rows.length === 0) return res.status(404).json({ message: '找不到房間或房間已開始' });

            const room = rows[0];
            await query(
                `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [room.id, userData.userId]
            );
            return res.status(200).json({ success: true, roomId: room.id, routeId: room.route_id, dirIndex: room.dir_index });
        } catch (e) {
            return res.status(500).json({ message: e.message });
        }
    }

    if (req.body.action === 'start-room-ride') {
        const userData = await authenticate(req, res);
        if (!userData) return;
        try {
            const { roomId } = req.body;
            const { rows } = await query(`SELECT host_id FROM ride_rooms WHERE id = $1`, [roomId]);
            if (rows[0]?.host_id !== userData.userId) return res.status(403).json({ message: '只有房主可以開始騎行' });

            await query(`UPDATE ride_rooms SET status = 'started' WHERE id = $1`, [roomId]);
            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ message: e.message });
        }
    }

    if (req.body.action === 'add_friend') {
      try {
        const { user_id, friend_id } = req.body;
        if (!user_id || !friend_id) return res.status(400).json({ message: 'IDs required' });
        if (user_id == friend_id) return res.status(400).json({ message: 'Cannot add yourself' });

        await query(
          `INSERT INTO user_friends (user_id, friend_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (user_id, friend_id) DO NOTHING`,
          [user_id, friend_id]
        );
        return res.status(200).json({ message: 'Friend request sent' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    if (req.body.action === 'accept_friend') {
      try {
        const { user_id, friend_id } = req.body;
        await query(
          `UPDATE user_friends SET status = 'accepted', updated_at = NOW()
           WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
          [user_id, friend_id]
        );
        return res.status(200).json({ message: 'Friend request accepted' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    if (req.body.action === 'claim-catalog-reward') {
      try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ message: 'user_id required' });

        // Ensure column exists to track claim status
        await query(`ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS catalog_reward_claimed BOOLEAN DEFAULT FALSE`);

        const { rows } = await query(`SELECT catalog_reward_claimed FROM user_game_profile WHERE user_id = $1`, [user_id]);
        if (rows.length > 0 && rows[0].catalog_reward_claimed) {
          return res.status(400).json({ message: 'Reward already claimed' });
        }

        // Award 10,000 XP and 1,000 Coins
        await query(
          `UPDATE user_game_profile
           SET xp = xp + 10000,
               coins = coins + 1000,
               catalog_reward_claimed = TRUE
           WHERE user_id = $1`,
          [user_id]
        );

        return res.status(200).json({
          message: 'Reward claimed successfully!',
          added_xp: 10000,
          added_coins: 1000
        });
      } catch (error) {
        console.error('Claim catalog reward error:', error);
        return res.status(500).json({ message: error.message });
      }
    }

    try {
      const {
        user_id,
        google_id,
        email,
        full_name,
        phone,
        username,
        experience,
        preferred_area,
        birthdate,
        bike_type,
        avatar_url,
      } = req.body;

      if (!full_name && !Object.prototype.hasOwnProperty.call(req.body, 'avatar_url') && !Object.prototype.hasOwnProperty.call(req.body, 'username')) {
        return res.status(400).json({ message: 'Full name or username is required' });
      }

      let preferredAreaStr = '';
      if (preferred_area) {
        preferredAreaStr = Array.isArray(preferred_area)
          ? preferred_area.join(',')
          : String(preferred_area).trim();
      }

      if (!user_id && !google_id && !email) {
        return res.status(400).json({ message: 'User identifier required' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'username')) {
        await ensureUsersUsernameColumn();
      }

      let checkResult;
      if (user_id) {
        checkResult = await query('SELECT id, email, user_role, username FROM users WHERE id = $1', [user_id]);
      } else if (google_id) {
        checkResult = await query('SELECT id, email, user_role, username FROM users WHERE google_id = $1', [google_id]);
      } else {
        checkResult = await query('SELECT id, email, user_role, username FROM users WHERE email = $1', [email]);
      }

      if (checkResult.rows.length === 0) {
        if (google_id && email) {
          await query(
            `INSERT INTO users (
              email, google_id, user_role, full_name, phone, experience,
              preferred_area, birthdate, bike_type, profile_completed,
              profile_completion_date, auth_provider
            ) VALUES ($1, $2, 'senior', $3, $4, $5, $6, $7, $8, true, NOW(), 'google')`,
            [email, google_id, full_name, phone || null, experience, preferredAreaStr,
             birthdate || null, bike_type || null]
          );
          return res.status(201).json({
            message: 'Profile created and upgraded to senior member',
            user_role: 'senior',
          });
        }
        return res.status(404).json({ message: 'User not found' });
      }

      const currentRole = checkResult.rows[0].user_role;
      const userId = checkResult.rows[0].id;
      const currentUsername = checkResult.rows[0].username || null;
      const hasFullProfile = experience && preferredAreaStr;

      let normalizedUsername = undefined;
      if (Object.prototype.hasOwnProperty.call(req.body, 'username')) {
        normalizedUsername = String(username || '').trim();
        if (!/^[A-Za-z0-9_]{4,16}$/.test(normalizedUsername)) {
          return res.status(400).json({ message: 'Username must be 4-16 characters and only include letters, numbers, underscore' });
        }
        if (!currentUsername || currentUsername.toLowerCase() !== normalizedUsername.toLowerCase()) {
          const { rows: usernameRows } = await query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1',
            [normalizedUsername, userId]
          );
          if (usernameRows.length > 0) {
            return res.status(409).json({ message: 'Username already exists' });
          }
        }
      }

      // Validate avatar_url if provided (must be http/https URL or data: URL, max 3MB original / ~4MB base64)
      let sanitizedAvatarUrl = undefined;
      if (Object.prototype.hasOwnProperty.call(req.body, 'avatar_url')) {
        if (!avatar_url) {
          sanitizedAvatarUrl = null;
        } else if (/^https?:\/\//i.test(avatar_url)) {
          sanitizedAvatarUrl = avatar_url.slice(0, 2048);
        } else if (/^data:image\/(jpeg|png|gif|webp);base64,/i.test(avatar_url)) {
          if (avatar_url.length > 4194304) {
            return res.status(400).json({ message: 'Avatar image too large (max 3MB)' });
          }
          sanitizedAvatarUrl = avatar_url;
        } else {
          return res.status(400).json({ message: 'Invalid avatar URL format' });
        }
      }

      // If only updating avatar, allow without full_name requirement
      if (!full_name && sanitizedAvatarUrl !== undefined) {
        await query(
          `UPDATE users SET avatar_url = $1 WHERE id = $2`,
          [sanitizedAvatarUrl, userId]
        );
        return res.status(200).json({ message: 'Avatar updated', user_role: currentRole });
      }

      if (!full_name && normalizedUsername !== undefined) {
        await query(
          `UPDATE users SET username = $1 WHERE id = $2`,
          [normalizedUsername, userId]
        );
        return res.status(200).json({ message: 'Username updated', user_role: currentRole });
      }

      if (hasFullProfile) {
        const newRole = currentRole === 'admin' ? 'admin' : 'senior';
        const profileCompleted = newRole !== 'admin';
        const params = [newRole, full_name, phone || null, experience, preferredAreaStr,
                        birthdate || null, bike_type || null, profileCompleted, userId];
        let avatarClause = '';
        let usernameClause = '';
        if (sanitizedAvatarUrl !== undefined) {
          avatarClause = `, avatar_url = $${params.push(sanitizedAvatarUrl)}`;
        }
        if (normalizedUsername !== undefined) {
          usernameClause = `, username = $${params.push(normalizedUsername)}`;
        }
        await query(
          `UPDATE users
            SET user_role = $1, full_name = $2, phone = $3, experience = $4,
                preferred_area = $5, birthdate = $6, bike_type = $7,
                profile_completed = $8,
                profile_completion_date = CASE WHEN $8 AND profile_completion_date IS NULL THEN NOW() ELSE profile_completion_date END
                ${usernameClause}
                ${avatarClause}
            WHERE id = $${params.length}`,
          params
        );
        return res.status(200).json({
          message: newRole === 'senior' ? 'Profile updated and upgraded to senior member' : 'Profile updated',
          user_role: newRole,
        });
      } else {
        const params = [full_name, phone || null, birthdate || null, bike_type || null, userId];
        let avatarClause = '';
        let usernameClause = '';
        if (sanitizedAvatarUrl !== undefined) {
          avatarClause = `, avatar_url = $${params.push(sanitizedAvatarUrl)}`;
        }
        if (normalizedUsername !== undefined) {
          usernameClause = `, username = $${params.push(normalizedUsername)}`;
        }
        await query(
          `UPDATE users
            SET full_name = $1, phone = $2, birthdate = $3, bike_type = $4
                ${usernameClause}
                ${avatarClause}
            WHERE id = $${params.length}`,
          params
        );
        return res.status(200).json({ message: 'Profile updated', user_role: currentRole });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
