// /api/getHistory.js
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

// 通用 JWT 驗證中介函數
async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing or invalid' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }
}

// 根據累計 XP 計算等級（使用 level_config 或內建配置）
function calcLevel(xp) {
  const thresholds = [0, 300, 700, 1200, 1800, 2600, 3500, 4500, 5800, 7500];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) { level = i + 1; break; }
  }
  return level;
}

// 確保用戶有遊戲進度記錄（若無則初始化）
async function ensureGameProfile(userId) {
  const { rows } = await query(
    'SELECT level, xp, coins FROM user_game_profile WHERE user_id = $1',
    [userId]
  );
  if (rows.length > 0) return rows[0];
  await query(
    'INSERT INTO user_game_profile (user_id, level, xp, coins) VALUES ($1, 1, 0, 0) ON CONFLICT DO NOTHING',
    [userId]
  );
  return { level: 1, xp: 0, coins: 0 };
}

export default async function handler(req, res) {
  // CORS headers for PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userData = await authenticate(req, res);
  if (!userData) return;

  // ── GET：騎行歷史（含遊戲進度）──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { rows: history } = await query(
        `SELECT id, ride_date, distance_km, route_name, route_id,
                duration_minutes, avg_speed_kmh, stops_reached, xp_earned, source
         FROM cycling_history
         WHERE user_id = $1
         ORDER BY ride_date DESC, created_at DESC`,
        [userData.userId]
      );

      // 附帶遊戲進度（方便前端一次性獲取）
      let gameProfile = null;
      try {
        gameProfile = await ensureGameProfile(userData.userId);
      } catch (e) {
        // game tables 可能尚未建立；忽略錯誤
      }

      return res.status(200).json({ history, gameProfile });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to fetch history' });
    }
  }

  // ── POST：提交新騎行紀錄 ─────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const {
        route_id,
        route_name,
        ride_date,
        start_time,
        end_time,
        distance_km,
        duration_minutes,
        avg_speed_kmh,
        stops_reached,
        gpx_track,
        source = 'pwa',
      } = req.body || {};

      if (!ride_date) {
        return res.status(400).json({ message: 'ride_date is required' });
      }

      // 1. 取得路線 XP 獎勵
      let xpReward = 0;
      try {
        const { rows: cfg } = await query(
          'SELECT xp_reward FROM routes_config WHERE route_id = $1',
          [route_id]
        );
        if (cfg.length > 0) xpReward = cfg[0].xp_reward;
        else {
          // 估算 XP：以距離為基準（每公里 20 XP）
          xpReward = Math.round((parseFloat(distance_km) || 0) * 20);
        }
      } catch (e) { /* routes_config 可能尚未建立 */ }

      // 2. 插入騎行記錄
      const { rows: newRide } = await query(
        `INSERT INTO cycling_history
           (user_id, ride_date, distance_km, route_name, route_id,
            start_time, end_time, duration_minutes, avg_speed_kmh,
            stops_reached, xp_earned, gpx_track, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          userData.userId,
          ride_date,
          distance_km || null,
          route_name || null,
          route_id || null,
          start_time || null,
          end_time || null,
          duration_minutes || null,
          avg_speed_kmh || null,
          stops_reached ? JSON.stringify(stops_reached) : null,
          xpReward,
          gpx_track || null,
          source,
        ]
      );
      const rideId = newRide[0].id;

      // 3. 更新遊戲進度
      let gameResult = { level: 1, xp: xpReward, coins: 0, level_up: false, coins_earned: 0, unlocked_routes: [] };
      try {
        const profile = await ensureGameProfile(userData.userId);
        const oldLevel = profile.level;
        const newXp = profile.xp + xpReward;
        const newLevel = calcLevel(newXp);
        let newCoins = profile.coins;
        let coinsEarned = 0;
        let levelUp = newLevel > oldLevel;

        if (levelUp) {
          // 累計升級獎勵里程幣
          const { rows: levelRows } = await query(
            'SELECT SUM(coins_reward) AS total FROM level_config WHERE level > $1 AND level <= $2',
            [oldLevel, newLevel]
          );
          coinsEarned = parseInt(levelRows[0]?.total || 0);
          newCoins += coinsEarned;
        }

        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET level = $2, xp = $3, coins = $4, updated_at = NOW()`,
          [userData.userId, newLevel, newXp, newCoins]
        );

        gameResult = {
          level: newLevel,
          xp: newXp,
          xp_earned: xpReward,
          coins: newCoins,
          level_up: levelUp,
          coins_earned: coinsEarned,
          unlocked_routes: [],
        };
      } catch (e) {
        console.warn('[getHistory POST] Game profile update skipped:', e.message);
      }

      return res.status(201).json({
        success: true,
        ride_id: rideId,
        ...gameResult,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to submit ride' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
