// /api/google-auth.js
// 接收並驗證 Google Identity Services (GIS) 發出的 ID Token，
// 然後在資料庫建立或查找對應的用戶。
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

/**
 * 呼叫 Google 的 tokeninfo 端點驗證 ID Token。
 * 回傳已驗證的 payload（含 sub, email, name, picture）。
 *
 * 注意：此方法需要一次網路請求來驗證 token。
 * 若需要在高流量環境降低延遲，可改用 google-auth-library 套件在本地驗證。
 * 參考：https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */
async function verifyGoogleCredential(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Google ID Token 驗證失敗，請重試。');
  }
  const payload = await resp.json();

  // 確認受眾（audience）是我們自己的 Client ID
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google Token 的受眾不符合，可能是偽造的 Token。');
  }

  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: '缺少 Google 憑證（credential）' });
    }

    // 1. 驗證 Google ID Token
    const payload = await verifyGoogleCredential(credential);
    const google_id = payload.sub;       // Google 用戶唯一 ID
    const email     = payload.email;
    const full_name = payload.name || '';

    if (!google_id || !email) {
      return res.status(400).json({ message: 'Google Token 中缺少用戶資訊' });
    }

    // 2. 查詢資料庫是否已有此用戶
    const { rows } = await query(
      'SELECT id, email, username, user_role, full_name, profile_completed, google_id, email_verified FROM users WHERE google_id = $1 OR email = $2',
      [google_id, email]
    );

    let user;

    // 已知管理員電郵清單（與 database-schema.sql 種子資料同步）
    const ADMIN_EMAILS = ['ctrcz9829@gmail.com'];

    if (rows.length > 0) {
      user = rows[0];

      // 若用戶原本以 email 方式註冊，補上 google_id 並標記電郵已驗證
      // （Google 帳號代表 Google 已驗證此電郵，無需再次驗證）
      const needsGoogleId    = !rows[0].google_id;
      const needsVerification = !rows[0].email_verified;
      // 若該電郵屬於已知管理員但資料庫角色尚未設為 admin，自動修正
      const needsAdminRole   = ADMIN_EMAILS.includes(email.toLowerCase()) && rows[0].user_role !== 'admin';

      if (needsGoogleId && needsVerification) {
        await query(
          `UPDATE users
             SET google_id = $1, email_verified = true,
                 verification_token = NULL, verification_token_expiry = NULL
           WHERE id = $2`,
          [google_id, user.id]
        );
      } else if (needsGoogleId) {
        await query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
      } else if (needsVerification) {
        await query(
          `UPDATE users
             SET email_verified = true,
                 verification_token = NULL, verification_token_expiry = NULL
           WHERE id = $1`,
          [user.id]
        );
      }

      if (needsAdminRole) {
        await query('UPDATE users SET user_role = $1 WHERE id = $2', ['admin', user.id]);
        user.user_role = 'admin';
      }

      if (needsVerification) {
        user.email_verified = true;
      }
    } else {
      // 3. 新用戶：建立帳號，管理員電郵直接設為 admin，其餘為 junior
      const newRole = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'junior';
      const baseName = String(email || '').split('@')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || `user${Date.now()}`;
      const usernameSeed = baseName.length < 4 ? (baseName + '0000').slice(0, 4) : baseName;
      const { rows: usernameRows } = await query(
        `SELECT username FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(username) LIKE LOWER($2)`,
        [usernameSeed, `${usernameSeed}%`]
      );
      const taken = new Set(usernameRows.map((r) => String(r.username || '').toLowerCase()));
      let finalUsername = usernameSeed;
      if (taken.has(finalUsername.toLowerCase())) {
        let found = false;
        for (let i = 1; i <= 9999; i++) {
          const suffix = String(i);
          const candidate = (usernameSeed.slice(0, Math.max(0, 16 - suffix.length)) + suffix).slice(0, 16);
          if (candidate.length >= 4 && !taken.has(candidate.toLowerCase())) {
            finalUsername = candidate;
            found = true;
            break;
          }
        }
        if (!found) {
          finalUsername = (`u${Date.now()}`).slice(-16);
        }
      }
      const insertResult = await query(
        `INSERT INTO users (email, google_id, username, full_name, user_role, auth_provider, profile_completed, email_verified)
         VALUES ($1, $2, $3, $4, $5, 'google', false, true)
         RETURNING id, email, username, user_role, full_name, profile_completed`,
        [email, google_id, finalUsername, full_name, newRole]
      );
      user = insertResult.rows[0];
    }

    // 4. 簽發 JWT（與 email 登入流程保持一致）
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('伺服器未設置 JWT_SECRET 環境變數，請聯絡管理員。');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.user_role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 獲取最新的 full_name
    const fullNameToReturn = user.full_name || full_name || '';

    return res.status(200).json({
      message: rows.length > 0 ? '登入成功' : '已建立新帳號',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || '',
        full_name: fullNameToReturn,
        user_role: user.user_role,
        role: user.user_role,
        profile_completed: user.profile_completed,
        email_verified: true // Google 帳號視為已驗證
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ message: error.message });
  }
}
