// /api/getHistory.js
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

// Maximum bonus coins a client can claim per ride (prevents abuse)
const MAX_BONUS_COINS_PER_RIDE = 20;

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

// 根據累計 XP 計算等級（50 級設計，無硬性上限）
function calcLevel(xp) {
  const thresholds = [
    0, 80, 200, 380, 620, 950, 1400, 1980, 2700, 3600,
    4000, 5100, 6500, 8100, 10000, 12200, 14800, 17800, 21200, 25200,
    28200, 33000, 38300, 44200, 50600, 57800, 65500, 74100, 83500, 93900,
    98800, 110600, 123500, 137800, 153500, 170700, 189700, 210500, 233500, 258700,
    267300, 295800, 327100, 361500, 399400, 441100, 487000, 537500, 593000, 654000,
  ];
  const BASE_GAP = 61000;   // gap entering L50→L51
  const GROWTH   = 1.10;    // 10% growth per level beyond L50
  const BASE_XP  = 654000;  // XP required for L50
  const BASE_LVL = 50;

  if (xp < BASE_XP) {
    // Binary search within the fixed table
    let lo = 0, hi = thresholds.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (thresholds[mid] <= xp) lo = mid; else hi = mid - 1;
    }
    return lo + 1; // 1-indexed
  }

  // For levels beyond L50, use the geometric series formula:
  // threshold(n) = BASE_XP + BASE_GAP * (GROWTH^(n-BASE_LVL) - 1) / (GROWTH - 1)
  // Solving for n:  n = BASE_LVL + log(1 + (xp - BASE_XP) * (GROWTH-1) / BASE_GAP) / log(GROWTH)
  const n = BASE_LVL + Math.log(1 + (xp - BASE_XP) * (GROWTH - 1) / BASE_GAP) / Math.log(GROWTH);
  return Math.floor(n) + 1;
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
        xp_earned_override,   // per-stop + district-change XP calculated client-side
        bonus_coins,          // e.g. +5 for finishing within 45 min
      } = req.body || {};

      if (!ride_date) {
        return res.status(400).json({ message: 'ride_date is required' });
      }

      // 過濾過短的騎行（少於2個車站且少於1公里，不計算入歷史）
      const stopsCount = Array.isArray(stops_reached) ? stops_reached.length : 0;
      const distKmVal = parseFloat(distance_km) || 0;
      if (stopsCount < 2 && distKmVal < 1) {
        let profile = { level: 1, xp: 0, coins: 0 };
        try { profile = await ensureGameProfile(userData.userId); } catch(e) {}
        return res.status(200).json({
          success: true,
          skipped: true,
          xp_earned: 0,
          level: profile.level,
          xp: profile.xp,
          coins: profile.coins,
          level_up: false,
          coins_earned: 0,
          bonus_coins_earned: 0,
        });
      }

      // 1. 取得路線 XP 獎勵
      let xpReward = 0;
      let maxXpForRoute = Infinity;
      try {
        const { rows: cfg } = await query(
          'SELECT xp_reward FROM routes_config WHERE route_id = $1',
          [route_id]
        );
        if (cfg.length > 0) {
          maxXpForRoute = cfg[0].xp_reward;
          xpReward = cfg[0].xp_reward;
        } else {
          // Fallback: ~20 XP per km. This roughly matches configured rewards
          // (e.g. route 900 = 5.5 km → ~110 XP, configured at 150), giving a
          // fair estimate for routes not yet in routes_config.
          const XP_PER_KM = 20;
          xpReward = Math.round((parseFloat(distance_km) || 0) * XP_PER_KM);
          maxXpForRoute = xpReward;
        }
      } catch (e) { /* routes_config 可能尚未建立 */ }

      // If client provides a per-stop computed XP, use it (capped at the route's configured max).
      // This supports the per-stop (+10 XP) and district-change (+20 XP) bonus system.
      if (typeof xp_earned_override === 'number' && xp_earned_override >= 0) {
        xpReward = Math.min(Math.round(xp_earned_override), maxXpForRoute);
      }

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

        // 45分鐘內完成路線的額外里程幣獎勵（客戶端傳入）
        const bonusCoinsEarned = (typeof bonus_coins === 'number' && bonus_coins > 0)
          ? Math.min(bonus_coins, MAX_BONUS_COINS_PER_RIDE)  // cap to prevent abuse
          : 0;
        if (bonusCoinsEarned > 0) {
          newCoins += bonusCoinsEarned;
          coinsEarned += bonusCoinsEarned;
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
          bonus_coins_earned: bonusCoinsEarned,
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
