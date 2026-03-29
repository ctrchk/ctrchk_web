// /api/admin-users.js
// 管理員 API - 查看用戶列表
import { query } from './_db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 根據累計 XP 計算等級（與 getHistory.js 保持一致）
function calcLevel(xp) {
  const thresholds = [
    0, 80, 200, 380, 620, 950, 1400, 1980, 2700, 3600,
    4000, 5100, 6500, 8100, 10000, 12200, 14800, 17800, 21200, 25200,
    28200, 33000, 38300, 44200, 50600, 57800, 65500, 74100, 83500, 93900,
    98800, 110600, 123500, 137800, 153500, 170700, 189700, 210500, 233500, 258700,
    267300, 295800, 327100, 361500, 399400, 441100, 487000, 537500, 593000, 654000,
  ];
  const BASE_GAP = 61000;
  const GROWTH   = 1.10;
  const BASE_XP  = 654000;
  const BASE_LVL = 50;

  if (xp < BASE_XP) {
    let lo = 0, hi = thresholds.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (thresholds[mid] <= xp) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  }
  const n = BASE_LVL + Math.log(1 + (xp - BASE_XP) * (GROWTH - 1) / BASE_GAP) / Math.log(GROWTH);
  return Math.floor(n) + 1;
}

/**
 * 驗證管理員身份的中間件
 */
function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing token', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    return { error: 'Server configuration error', status: 500 };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return { error: 'Forbidden: Admin access required', status: 403 };
    }
    return { decoded };
  } catch (err) {
    return { error: 'Unauthorized: Invalid token', status: 401 };
  }
}

export default async function handler(req, res) {
  // CORS headers for admin panel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 驗證管理員
  const authResult = verifyAdmin(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ message: authResult.error });
  }

  // GET: 獲取用戶列表 / 部門與路線配置
  if (req.method === 'GET') {
    // GET department configs
    if (req.query.action === 'get-dept-config') {
      try {
        const { rows } = await query('SELECT dept_id, name, unlock_cost, promo_cost, is_promo FROM department_config ORDER BY dept_id');
        return res.status(200).json({ departments: rows });
      } catch (e) {
        console.error('[admin-users] get-dept-config error:', e.message);
        return res.status(500).json({ message: '載入部門設定失敗', departments: [] });
      }
    }

    // GET route configs (coin routes only)
    if (req.query.action === 'get-route-config') {
      try {
        const { rows } = await query(`SELECT route_id, unlock_cost, promo_cost, is_special FROM routes_config WHERE is_special = TRUE ORDER BY route_id`);
        return res.status(200).json({ routes: rows });
      } catch (e) {
        console.error('[admin-users] get-route-config error:', e.message);
        return res.status(500).json({ message: '載入路線設定失敗', routes: [] });
      }
    }

    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let whereClause = '';
      let params = [limit, offset];
      
      if (search) {
        whereClause = `WHERE u.email ILIKE $3 OR u.full_name ILIKE $3 OR u.username ILIKE $3`;
        params.push(`%${search}%`);
      }

      // 獲取用戶列表（不含密碼）
      const usersResult = await query(
        `SELECT 
          u.id,
          u.email,
          u.username,
          u.full_name,
          u.user_role,
          u.phone,
          u.experience,
          u.preferred_area,
          u.profile_completed,
          u.email_verified,
          u.auth_provider,
          u.created_at,
          COUNT(DISTINCT ch.id) AS ride_count,
          COALESCE(SUM(ch.distance_km), 0) AS total_distance
         FROM users u
         LEFT JOIN cycling_history ch ON u.id = ch.user_id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      // 獲取總用戶數
      const countResult = await query(
        search 
          ? `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR full_name ILIKE $1 OR username ILIKE $1`
          : `SELECT COUNT(*) FROM users`,
        search ? [`%${search}%`] : []
      );

      const total = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        users: usersResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Admin get users error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // POST: 修改用戶角色
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { action } = body;

      // Update department config (standard price + promo settings)
      if (action === 'update-dept-config') {
        const { dept_id, is_promo, promo_cost, unlock_cost } = body;
        if (!dept_id) return res.status(400).json({ message: 'dept_id is required' });
        await query(
          `UPDATE department_config SET unlock_cost = COALESCE($1, unlock_cost), is_promo = $2, promo_cost = $3 WHERE dept_id = $4`,
          [
            unlock_cost != null ? parseInt(unlock_cost, 10) : null,
            is_promo,
            promo_cost != null ? parseInt(promo_cost, 10) : null,
            dept_id,
          ]
        );
        return res.status(200).json({ success: true });
      }


      // Update route promo price
      if (action === 'update-route-promo') {
        const { route_id, promo_cost } = body;
        if (!route_id) return res.status(400).json({ message: 'route_id is required' });
        await query(
          `UPDATE routes_config SET promo_cost = $1 WHERE route_id = $2`,
          [promo_cost != null ? parseInt(promo_cost, 10) : null, route_id]
        );
        return res.status(200).json({ success: true });
      }

      const { user_id, new_role } = body;

      if (!action) {
        return res.status(400).json({ message: 'action is required' });
      }

      const actionsRequiringUserId = new Set([
        'set_role',
        'delete_user',
        'get_game_profile',
        'set_game_stats',
        'grant_route',
        'revoke_route',
      ]);
      if (actionsRequiringUserId.has(action) && !user_id) {
        return res.status(400).json({ message: 'user_id is required' });
      }

      if (action === 'set_role') {
        const validRoles = ['junior', 'senior', 'admin'];
        if (!validRoles.includes(new_role)) {
          return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        await query(
          `UPDATE users SET user_role = $1 WHERE id = $2`,
          [new_role, user_id]
        );

        return res.status(200).json({ message: `User ${user_id} role updated to ${new_role}` });
      }

      if (action === 'delete_user') {
        await query(`DELETE FROM users WHERE id = $1`, [user_id]);
        return res.status(200).json({ message: `User ${user_id} deleted` });
      }

      if (action === 'get_game_profile') {
        // 取得指定用戶的遊戲資料（等級、XP、里程幣、已解鎖路線）
        const userResult = await query(
          `SELECT u.id, u.email, u.full_name,
                  COALESCE(gp.level, 1)  AS level,
                  COALESCE(gp.xp,    0)  AS xp,
                  COALESCE(gp.coins, 0)  AS coins
           FROM users u
           LEFT JOIN user_game_profile gp ON gp.user_id = u.id
           WHERE u.id = $1`,
          [user_id]
        );
        if (userResult.rows.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        const routesResult = await query(
          `SELECT route_id, unlock_method, unlocked_at
           FROM user_unlocked_routes
           WHERE user_id = $1
           ORDER BY unlocked_at ASC`,
          [user_id]
        );

        return res.status(200).json({
          user: userResult.rows[0],
          unlocked_routes: routesResult.rows
        });
      }

      if (action === 'set_game_stats') {
        // 更新用戶的 XP、里程幣（等級由 XP 自動計算）
        const { xp, coins } = req.body;

        if (xp === undefined && coins === undefined) {
          return res.status(400).json({ message: 'At least one of xp, coins must be provided' });
        }
        if (xp !== undefined && (typeof xp !== 'number' || xp < 0)) {
          return res.status(400).json({ message: 'xp must be a non-negative number' });
        }
        if (coins !== undefined && (typeof coins !== 'number' || coins < 0)) {
          return res.status(400).json({ message: 'coins must be a non-negative number' });
        }

        // 若有提供 XP，自動計算對應等級
        let newLevel = undefined;
        if (xp !== undefined) {
          newLevel = calcLevel(xp);
        }

        // 確保 user_game_profile 列存在，並更新
        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, COALESCE($2, 1), COALESCE($3, 0), COALESCE($4, 0), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             level      = CASE WHEN $2 IS NOT NULL THEN $2 ELSE user_game_profile.level END,
             xp         = CASE WHEN $3 IS NOT NULL THEN $3 ELSE user_game_profile.xp   END,
             coins      = CASE WHEN $4 IS NOT NULL THEN $4 ELSE user_game_profile.coins END,
             updated_at = NOW()`,
          [user_id,
           newLevel !== undefined ? newLevel : null,
           xp    !== undefined ? xp    : null,
           coins !== undefined ? coins : null]
        );

        return res.status(200).json({ message: `User ${user_id} game stats updated`, level: newLevel });
      }

      if (action === 'grant_route') {
        const { route_id } = req.body;
        if (!route_id) {
          return res.status(400).json({ message: 'route_id is required' });
        }

        await query(
          `INSERT INTO user_unlocked_routes (user_id, route_id, unlock_method, unlocked_at)
           VALUES ($1, $2, 'admin', NOW())
           ON CONFLICT (user_id, route_id) DO NOTHING`,
          [user_id, route_id]
        );

        return res.status(200).json({ message: `Route ${route_id} granted to user ${user_id}` });
      }

      if (action === 'revoke_route') {
        const { route_id } = req.body;
        if (!route_id) {
          return res.status(400).json({ message: 'route_id is required' });
        }

        await query(
          `DELETE FROM user_unlocked_routes WHERE user_id = $1 AND route_id = $2`,
          [user_id, route_id]
        );

        return res.status(200).json({ message: `Route ${route_id} revoked from user ${user_id}` });
      }

      if (action === 'create_admin') {
        const { email, full_name, password, username, role = 'admin' } = req.body;

        if (!email || !full_name || !password) {
          return res.status(400).json({ message: 'Email, name, and password are required' });
        }
        if (password.length < 12) {
          return res.status(400).json({ message: 'Admin password must be at least 12 characters' });
        }
        const validRoles = ['admin', 'senior'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }

        // Validate username if provided
        let normalizedUsername = null;
        if (username) {
          normalizedUsername = String(username).trim();
          if (!/^[A-Za-z0-9_]{4,16}$/.test(normalizedUsername)) {
            return res.status(400).json({ message: 'Username must be 4-16 characters (letters, numbers, underscore)' });
          }
          const { rows: uRows } = await query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [normalizedUsername]
          );
          if (uRows.length > 0) {
            return res.status(409).json({ message: 'Username already taken' });
          }
        }

        const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
          return res.status(409).json({ message: 'Email already exists' });
        }

        const salt = bcrypt.genSaltSync(12);
        const password_hash = bcrypt.hashSync(password, salt);

        await query(
          `INSERT INTO users (
            email, password_hash, user_role, full_name, username, profile_completed,
            auth_provider, email_verified
          ) VALUES ($1, $2, $3, $4, $5, true, 'email', true)`,
          [email, password_hash, role, full_name, normalizedUsername]
        );

        return res.status(201).json({
          message: `${role === 'admin' ? '管理員' : '高級會員'}帳戶建立成功`,
          email,
          role
        });
      }

      return res.status(400).json({ message: `Unknown action: ${action}` });

    } catch (error) {
      console.error('Admin action error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
