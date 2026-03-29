// /api/user.js
// Consolidated user profile endpoint.
//
//   GET  /api/user?user_id=X   → get user info (replaces get-user.js)
//   GET  /api/user?google_id=X → get user by Google ID
//   GET  /api/user?email=X     → get user by email
//   POST /api/user             → update profile (replaces update-profile.js)
//
import { query } from './_db.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET → fetch user info ───────────────────────────────────────────────
  if (req.method === 'GET') {
    // action=config → return public config (replaces config.js)
    if (req.query.action === 'config') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
    }

    try {
      const { google_id, email, user_id } = req.query;

      if (!google_id && !email && !user_id) {
        return res.status(400).json({ message: 'User identifier required (google_id, email, or user_id)' });
      }

      let result;
      const SELECT = `SELECT u.id, u.email, u.username, u.user_role, u.full_name, u.phone, u.profile_completed,
                             u.auth_provider, u.created_at, u.email_verified, u.avatar_url,
                             gp.level, gp.xp, gp.coins
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
  if (req.method === 'POST') {
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
