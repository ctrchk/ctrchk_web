// /api/reset-password.js
// 重設密碼：驗證 token 並更新新密碼
import { query } from './_db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: '缺少必要參數' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: '密碼長度至少需要 8 個字元' });
    }

    // 查找對應 token
    const { rows } = await query(
      `SELECT id, email, password_reset_token_expiry
         FROM users
        WHERE password_reset_token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: '無效的重設連結，請重新申請。' });
    }

    const user = rows[0];

    // 檢查 token 是否過期
    if (!user.password_reset_token_expiry || new Date() > new Date(user.password_reset_token_expiry)) {
      return res.status(400).json({
        message: '重設連結已過期（超過 1 小時），請重新申請忘記密碼。',
        expired: true
      });
    }

    // 加密新密碼
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    // 更新密碼並清除 reset token
    await query(
      `UPDATE users
          SET password_hash = $1,
              password_reset_token = NULL,
              password_reset_token_expiry = NULL,
              email_verified = true
        WHERE id = $2`,
      [password_hash, user.id]
    );

    return res.status(200).json({
      message: '密碼已成功重設！請使用新密碼登入。'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試。' });
  }
}
