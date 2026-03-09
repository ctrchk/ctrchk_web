// /api/get-user.js
import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { google_id, email, user_id } = req.query;

    if (!google_id && !email && !user_id) {
      return res.status(400).json({ message: 'User identifier required (google_id, email, or user_id)' });
    }

    let result;

    if (google_id) {
      result = await query(
        `SELECT u.id, u.email, u.user_role, u.full_name, u.phone, u.profile_completed,
                u.auth_provider, u.created_at, u.email_verified,
                gp.level, gp.xp, gp.coins
         FROM users u
         LEFT JOIN user_game_profile gp ON gp.user_id = u.id
         WHERE u.google_id = $1`,
        [google_id]
      );
    } else if (user_id) {
      result = await query(
        `SELECT u.id, u.email, u.user_role, u.full_name, u.phone, u.profile_completed,
                u.auth_provider, u.created_at, u.email_verified,
                gp.level, gp.xp, gp.coins
         FROM users u
         LEFT JOIN user_game_profile gp ON gp.user_id = u.id
         WHERE u.id = $1`,
        [user_id]
      );
    } else {
      result = await query(
        `SELECT u.id, u.email, u.user_role, u.full_name, u.phone, u.profile_completed,
                u.auth_provider, u.created_at, u.email_verified,
                gp.level, gp.xp, gp.coins
         FROM users u
         LEFT JOIN user_game_profile gp ON gp.user_id = u.id
         WHERE u.email = $1`,
        [email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    // 為未初始化遊戲進度的用戶設置默認值
    if (user.level === null || user.level === undefined) {
      user.level = 1;
      user.xp = 0;
      user.coins = 0;
    }

    return res.status(200).json(user);

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: error.message });
  }
}
