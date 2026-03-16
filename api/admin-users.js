// /api/admin-users.js
// 管理員 API - 查看用戶列表
import { query } from './_db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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

  // GET: 獲取用戶列表
  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let whereClause = '';
      let params = [limit, offset];
      
      if (search) {
        whereClause = `WHERE u.email ILIKE $3 OR u.full_name ILIKE $3`;
        params.push(`%${search}%`);
      }

      // 獲取用戶列表（不含密碼）
      const usersResult = await query(
        `SELECT 
          u.id,
          u.email,
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
          ? `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR full_name ILIKE $1`
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
      const { action, user_id, new_role } = req.body;

      if (!action || !user_id) {
        return res.status(400).json({ message: 'action and user_id are required' });
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
        // 更新用戶的等級、XP、里程幣（僅更新提供的欄位）
        const { level, xp, coins } = req.body;

        if (level === undefined && xp === undefined && coins === undefined) {
          return res.status(400).json({ message: 'At least one of level, xp, coins must be provided' });
        }
        if (level !== undefined && (typeof level !== 'number' || level < 1 || level > 20)) {
          return res.status(400).json({ message: 'level must be a number between 1 and 20' });
        }
        if (xp !== undefined && (typeof xp !== 'number' || xp < 0)) {
          return res.status(400).json({ message: 'xp must be a non-negative number' });
        }
        if (coins !== undefined && (typeof coins !== 'number' || coins < 0)) {
          return res.status(400).json({ message: 'coins must be a non-negative number' });
        }

        // 確保 user_game_profile 列存在
        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, COALESCE($2, 1), COALESCE($3, 0), COALESCE($4, 0), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             level      = CASE WHEN $2 IS NOT NULL THEN $2 ELSE user_game_profile.level END,
             xp         = CASE WHEN $3 IS NOT NULL THEN $3 ELSE user_game_profile.xp   END,
             coins      = CASE WHEN $4 IS NOT NULL THEN $4 ELSE user_game_profile.coins END,
             updated_at = NOW()`,
          [user_id,
           level !== undefined ? level : null,
           xp    !== undefined ? xp    : null,
           coins !== undefined ? coins : null]
        );

        return res.status(200).json({ message: `User ${user_id} game stats updated` });
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
        const { email, full_name, password, role = 'admin' } = req.body;

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

        const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
          return res.status(409).json({ message: 'Email already exists' });
        }

        const salt = bcrypt.genSaltSync(12);
        const password_hash = bcrypt.hashSync(password, salt);

        await query(
          `INSERT INTO users (
            email, password_hash, user_role, full_name, profile_completed,
            auth_provider, email_verified
          ) VALUES ($1, $2, $3, $4, true, 'email', true)`,
          [email, password_hash, role, full_name]
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
