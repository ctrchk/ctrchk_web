// /api/getHistory.js
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

// Maximum bonus coins a client can claim per ride (prevents abuse)
const MAX_BONUS_COINS_PER_RIDE = 20;

// 28-day daily check-in reward table — must match tasks.html CHECKIN_REWARDS
// Each entry: [xp, coins]. Index 0 is unused (days are 1-indexed).
const CHECKIN_REWARDS = [
  null,
  [20, 0],    // Day 1
  [30, 2],    // Day 2
  [50, 2],    // Day 3
  [70, 3],    // Day 4
  [80, 3],    // Day 5
  [100, 3],   // Day 6
  [200, 10],  // Day 7  ★
  [150, 5],   // Day 8
  [180, 8],   // Day 9
  [200, 8],   // Day 10
  [225, 8],   // Day 11
  [250, 8],   // Day 12
  [250, 10],  // Day 13
  [500, 20],  // Day 14 ★★
  [260, 10],  // Day 15
  [280, 11],  // Day 16
  [300, 12],  // Day 17
  [320, 13],  // Day 18
  [340, 14],  // Day 19
  [360, 15],  // Day 20
  [600, 30],  // Day 21 ★★★
  [375, 15],  // Day 22
  [400, 16],  // Day 23
  [425, 17],  // Day 24
  [450, 18],  // Day 25
  [475, 19],  // Day 26
  [500, 20],  // Day 27
  [1000, 100],// Day 28 ★★★★
];

// Calculate check-in streak ending at yesterday (i.e. consecutive days before today)
async function calcCheckinStreak(userId, todayStr) {
  const { rows } = await query(
    'SELECT checkin_date::text AS d FROM user_daily_checkins WHERE user_id = $1 ORDER BY checkin_date DESC',
    [userId]
  );
  const dateSet = new Set(rows.map(r => r.d.slice(0, 10)));
  const oneDayMs = 86400000;
  let streak = 0;
  let check = new Date(todayStr + 'T00:00:00Z');
  check = new Date(check.getTime() - oneDayMs); // start from yesterday
  for (let i = 0; i < 366; i++) {
    const key = check.toISOString().slice(0, 10);
    if (dateSet.has(key)) {
      streak++;
      check = new Date(check.getTime() - oneDayMs);
    } else {
      break;
    }
  }
  return streak;
}

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

async function tableExists(tableName) {
  try {
    const { rows } = await query('SELECT to_regclass($1) AS reg', [`public.${tableName}`]);
    return !!rows[0]?.reg;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS headers for PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userData = await authenticate(req, res);
  if (!userData) return;

  // ── GET：排行榜 ──────────────────────────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'leaderboard') {
    try {
      const routeId = req.query.route_id || null;
      const hasCyclingHistory = await tableExists('cycling_history');
      if (!hasCyclingHistory) {
        return res.status(200).json({ rankings: [], my_rank: null });
      }

      let rankingsQuery, rankingsParams;
      if (routeId) {
        rankingsQuery = `
          SELECT u.id AS user_id,
                 COALESCE(u.username, u.full_name, '匿名騎手') AS display_name,
                 COUNT(*)::int AS rides,
                 ROUND(SUM(ch.distance_km)::numeric, 1) AS total_distance,
                 ROUND(AVG(ch.avg_speed_kmh)::numeric, 1) AS avg_speed
          FROM cycling_history ch
          JOIN users u ON ch.user_id = u.id
          WHERE ch.route_id = $1
            AND ch.distance_km > 0
          GROUP BY u.id, u.username, u.full_name
          ORDER BY total_distance DESC
          LIMIT 20`;
        rankingsParams = [routeId];
      } else {
        rankingsQuery = `
          SELECT u.id AS user_id,
                 COALESCE(u.username, u.full_name, '匿名騎手') AS display_name,
                 COUNT(*)::int AS rides,
                 ROUND(SUM(ch.distance_km)::numeric, 1) AS total_distance,
                 ROUND(AVG(ch.avg_speed_kmh)::numeric, 1) AS avg_speed
          FROM cycling_history ch
          JOIN users u ON ch.user_id = u.id
          WHERE ch.distance_km > 0
          GROUP BY u.id, u.username, u.full_name
          ORDER BY total_distance DESC
          LIMIT 20`;
        rankingsParams = [];
      }

      const { rows: rankings } = await query(rankingsQuery, rankingsParams);

      // Find current user's rank
      let myRank = null;
      const myIdx = rankings.findIndex(r => r.user_id === userData.userId);
      if (myIdx >= 0) {
        myRank = myIdx + 1;
      } else {
        // User not in top 20 – compute their actual rank
        let myStatsQuery, myStatsParams;
        if (routeId) {
          myStatsQuery = `
            SELECT ROUND(SUM(distance_km)::numeric, 1) AS total_distance
            FROM cycling_history
            WHERE user_id = $1 AND route_id = $2 AND distance_km > 0`;
          myStatsParams = [userData.userId, routeId];
        } else {
          myStatsQuery = `
            SELECT ROUND(SUM(distance_km)::numeric, 1) AS total_distance
            FROM cycling_history
            WHERE user_id = $1 AND distance_km > 0`;
          myStatsParams = [userData.userId];
        }
        const { rows: myStats } = await query(myStatsQuery, myStatsParams);
        const myDist = parseFloat(myStats[0]?.total_distance || 0);
        if (myDist > 0) {
          let rankQuery, rankParams;
          if (routeId) {
            rankQuery = `
              SELECT COUNT(*)::int AS rank_above FROM (
                SELECT user_id, SUM(distance_km) AS td
                FROM cycling_history
                WHERE route_id = $1 AND distance_km > 0
                GROUP BY user_id
                HAVING SUM(distance_km) > $2
              ) ranked`;
            rankParams = [routeId, myDist];
          } else {
            rankQuery = `
              SELECT COUNT(*)::int AS rank_above FROM (
                SELECT user_id, SUM(distance_km) AS td
                FROM cycling_history
                WHERE distance_km > 0
                GROUP BY user_id
                HAVING SUM(distance_km) > $1
              ) ranked`;
            rankParams = [myDist];
          }
          const { rows: rankRows } = await query(rankQuery, rankParams);
          myRank = (rankRows[0]?.rank_above || 0) + 1;
        }
      }

      return res.status(200).json({
        rankings: rankings.map((r, i) => ({
          rank: i + 1,
          user_id: r.user_id,
          display_name: r.display_name,
          rides: r.rides,
          total_distance: parseFloat(r.total_distance) || 0,
          avg_speed: parseFloat(r.avg_speed) || null,
          is_me: r.user_id === userData.userId,
        })),
        my_rank: myRank,
      });
    } catch (error) {
      console.error('[leaderboard] error:', error);
      return res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  }

  // ── GET：騎行歷史（含遊戲進度）──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const hasCyclingHistory = await tableExists('cycling_history');
      const hasDailyCheckins = await tableExists('user_daily_checkins');

      const history = hasCyclingHistory
        ? (await query(
            `SELECT id, ride_date, distance_km, route_name, route_id,
                    start_time, duration_minutes, avg_speed_kmh, stops_reached,
                    stops_count, all_stops, districts_count, xp_earned, source
             FROM cycling_history
             WHERE user_id = $1
             ORDER BY ride_date DESC, created_at DESC`,
            [userData.userId]
          )).rows
        : [];
      const normalizedHistory = history.map((h) => {
        const stopsArr = Array.isArray(h.stops_reached) ? h.stops_reached : [];
        return {
          route_id: h.route_id,
          date: h.ride_date,
          start_time: h.start_time || null,
          duration_minutes: h.duration_minutes || 0,
          distance_km: Number(h.distance_km || 0),
          stops_count: Number.isFinite(h.stops_count) ? h.stops_count : stopsArr.length,
          stops_reached: stopsArr,
          all_stops: !!h.all_stops,
          districts_count: Number.isFinite(h.districts_count) ? h.districts_count : 0,
        };
      });

      const checkins = hasDailyCheckins
        ? (await query(
            `SELECT checkin_date::text AS checkin_date
             FROM user_daily_checkins
             WHERE user_id = $1
             ORDER BY checkin_date DESC
             LIMIT 90`,
            [userData.userId]
          )).rows
        : [];

      // 附帶遊戲進度（方便前端一次性獲取）
      let gameProfile = null;
      try {
        gameProfile = await ensureGameProfile(userData.userId);
      } catch (e) {
        // game tables 可能尚未建立；忽略錯誤
      }

      return res.status(200).json({ history, normalized_history: normalizedHistory, checkins, gameProfile });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to fetch history' });
    }
  }

  // ── POST：提交新騎行紀錄 or 每日簽到 ────────────────────────────────────
  if (req.method === 'POST') {
    // ── POST?action=purchase-route：里程幣購買路線 ──────────────────────
    if (req.query.action === 'purchase-route') {
      try {
        const { route_id } = req.body || {};
        if (!route_id) {
          return res.status(400).json({ message: 'route_id is required' });
        }

        // Fetch route cost from routes_config
        const { rows: cfgRows } = await query(
          'SELECT route_id, unlock_cost, is_special FROM routes_config WHERE route_id = $1',
          [route_id]
        );
        if (cfgRows.length === 0 || !cfgRows[0].is_special) {
          return res.status(400).json({ message: 'Route not available for purchase' });
        }
        const cost = parseInt(cfgRows[0].unlock_cost || 0, 10);

        // Fetch profile once for both the already-unlocked check and coin check
        const profile = await ensureGameProfile(userData.userId);

        // Check if already unlocked
        const { rows: existing } = await query(
          'SELECT id FROM user_unlocked_routes WHERE user_id = $1 AND route_id = $2',
          [userData.userId, route_id]
        );
        if (existing.length > 0) {
          return res.status(200).json({
            already_unlocked: true,
            gameProfile: profile,
          });
        }

        // Ensure user has enough coins
        if (profile.coins < cost) {
          return res.status(400).json({
            message: '里程幣不足',
            required: cost,
            current: profile.coins,
          });
        }

        // Deduct coins and record purchase
        const newCoins = profile.coins - cost;
        await query(
          `UPDATE user_game_profile SET coins = $1, updated_at = NOW() WHERE user_id = $2`,
          [newCoins, userData.userId]
        );
        await query(
          `INSERT INTO user_unlocked_routes (user_id, route_id, unlock_method)
           VALUES ($1, $2, 'purchase') ON CONFLICT (user_id, route_id) DO NOTHING`,
          [userData.userId, route_id]
        );

        return res.status(200).json({
          success: true,
          coins_spent: cost,
          gameProfile: { ...profile, coins: newCoins },
        });
      } catch (error) {
        console.error('[purchase-route] error:', error);
        return res.status(500).json({ message: 'Failed to process purchase' });
      }
    }

    // ── POST?action=purchase-department：里程幣解鎖部門 ──────────────────────
    if (req.query.action === 'purchase-department') {
      try {
        const { dept_id } = req.body || {};
        if (!dept_id) return res.status(400).json({ message: 'Missing dept_id' });

        // Fetch department config
        const { rows: deptRows } = await query(
          'SELECT dept_id, unlock_cost, promo_cost, is_promo FROM department_config WHERE dept_id = $1',
          [dept_id]
        );
        if (!deptRows.length) return res.status(400).json({ message: 'Department not found' });

        const deptCfg = deptRows[0];
        const cost = deptCfg.is_promo && deptCfg.promo_cost != null
          ? parseInt(deptCfg.promo_cost, 10)
          : parseInt(deptCfg.unlock_cost, 10);

        const profile = await ensureGameProfile(userData.userId);

        // Check if already unlocked
        const { rows: existRows } = await query(
          'SELECT id FROM user_unlocked_departments WHERE user_id = $1 AND dept_id = $2',
          [userData.userId, dept_id]
        );
        if (existRows.length) {
          return res.status(200).json({ already_unlocked: true, gameProfile: profile });
        }

        if (profile.coins < cost) {
          return res.status(400).json({ message: '里程幣不足', required: cost, current: profile.coins });
        }

        const newCoins = profile.coins - cost;
        await query(
          `UPDATE user_game_profile SET coins = $1, updated_at = NOW() WHERE user_id = $2`,
          [newCoins, userData.userId]
        );
        await query(
          `INSERT INTO user_unlocked_departments (user_id, dept_id, unlock_method) VALUES ($1, $2, 'purchase') ON CONFLICT DO NOTHING`,
          [userData.userId, dept_id]
        );

        return res.status(200).json({
          dept_id,
          coins_spent: cost,
          gameProfile: { ...profile, coins: newCoins },
        });
      } catch (error) {
        console.error('[purchase-department] error:', error);
        return res.status(500).json({ message: 'Failed to process department purchase' });
      }
    }

    // ── POST?action=checkin：每日簽到 ──────────────────────────────────
    if (req.query.action === 'checkin') {
      try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

        // Check if already checked in today
        const { rows: existing } = await query(
          'SELECT id, xp_earned, coins_earned, streak_day FROM user_daily_checkins WHERE user_id = $1 AND checkin_date = $2',
          [userData.userId, today]
        );
        if (existing.length > 0) {
          const profile = await ensureGameProfile(userData.userId);
          return res.status(200).json({
            already_checked_in: true,
            xp_earned: existing[0].xp_earned,
            coins_earned: existing[0].coins_earned,
            streak: existing[0].streak_day,
            gameProfile: profile,
          });
        }

        // Calculate streak (consecutive days ending yesterday)
        const streak = await calcCheckinStreak(userData.userId, today);
        const newStreak = streak + 1;
        const cycleDay = ((newStreak - 1) % 28) + 1;
        const [xpEarned, coinsEarned] = CHECKIN_REWARDS[cycleDay] || [20, 0];

        // Record check-in
        await query(
          `INSERT INTO user_daily_checkins (user_id, checkin_date, xp_earned, coins_earned, streak_day)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, checkin_date) DO NOTHING`,
          [userData.userId, today, xpEarned, coinsEarned, newStreak]
        );

        // Update game profile
        const profile = await ensureGameProfile(userData.userId);
        const oldLevel = profile.level;
        const newXp = profile.xp + xpEarned;
        const newCoins = profile.coins + coinsEarned;
        const newLevel = calcLevel(newXp);
        const levelUp = newLevel > oldLevel;

        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET level = $2, xp = $3, coins = $4, updated_at = NOW()`,
          [userData.userId, newLevel, newXp, newCoins]
        );

        const gameProfile = { level: newLevel, xp: newXp, coins: newCoins };
        return res.status(200).json({
          success: true,
          xp_earned: xpEarned,
          coins_earned: coinsEarned,
          streak: newStreak,
          cycle_day: cycleDay,
          level_up: levelUp,
          gameProfile,
        });
      } catch (error) {
        console.error('[checkin] error:', error);
        return res.status(500).json({ message: 'Failed to process check-in' });
      }
    }

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
        stops_count,
        all_stops,
        districts_count,
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
             stops_reached, stops_count, all_stops, districts_count, xp_earned, gpx_track, source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
          Number.isFinite(stops_count) ? Math.max(0, parseInt(stops_count, 10)) : (Array.isArray(stops_reached) ? stops_reached.length : 0),
          !!all_stops,
          Number.isFinite(districts_count) ? Math.max(0, parseInt(districts_count, 10)) : 0,
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
