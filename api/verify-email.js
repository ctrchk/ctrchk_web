// /api/verify-email.js
import { query } from './db.js';
import { sendWelcomeEmail } from './email.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const token = req.query.token || req.body?.token;

    if (!token) {
      return res.status(400).json({ message: '缺少驗證 token' });
    }

    // 查找對應的 token
    const { rows } = await query(
      `SELECT id, email, full_name, email_verified, verification_token_expiry 
       FROM users 
       WHERE verification_token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: '無效的驗證連結，token 不存在或已使用。' });
    }

    const user = rows[0];

    if (user.email_verified) {
      return res.status(200).json({ message: '您的電郵已成功驗證，無需重複驗證。' });
    }

    // 檢查 token 是否過期
    if (user.verification_token_expiry && new Date() > new Date(user.verification_token_expiry)) {
      return res.status(400).json({ 
        message: '驗證連結已過期（超過 24 小時）。請重新申請驗證郵件。',
        expired: true
      });
    }

    // 更新用戶為已驗證，並清除 token
    await query(
      `UPDATE users 
       SET email_verified = true, verification_token = NULL, verification_token_expiry = NULL 
       WHERE id = $1`,
      [user.id]
    );

    // 發送歡迎郵件（非阻塞）
    sendWelcomeEmail(user.email, user.full_name).catch(err => {
      console.error('發送歡迎郵件失敗:', err);
    });

    return res.status(200).json({ 
      message: '電郵驗證成功！歡迎加入 CTRC HK。',
      email: user.email
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ message: error.message });
  }
}
