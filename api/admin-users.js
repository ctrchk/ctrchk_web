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
