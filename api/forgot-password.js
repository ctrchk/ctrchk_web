// /api/forgot-password.js
// 忘記密碼：生成重設 token 並寄送重設郵件
import { query } from './_db.js';
import crypto from 'crypto';
import { sendPasswordResetEmail } from './_email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: '請輸入電子郵件地址' });
    }

    // 查詢用戶（不管用戶是否存在，都回傳相同訊息以防止帳號枚舉攻擊）
    const { rows } = await query(
      'SELECT id, email, full_name, auth_provider FROM users WHERE email = $1',
      [email]
    );

    if (rows.length > 0) {
      const user = rows[0];

      // 若帳號為純 Google 帳號（沒有密碼），不發送重設郵件
      if (user.auth_provider === 'google') {
        // 仍回傳成功，避免洩露帳號資訊
        return res.status(200).json({
          message: '如果此電子郵件已註冊，您將收到密碼重設郵件。請檢查您的收件匣。'
        });
      }

      // 生成重設 token（1 小時有效）
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

      // 儲存 token 至資料庫
      await query(
        `UPDATE users
           SET password_reset_token = $1, password_reset_token_expiry = $2
         WHERE id = $3`,
        [resetToken, resetExpiry, user.id]
      );

      // 發送重設郵件（非阻塞）
      sendPasswordResetEmail(user.email, user.full_name, resetToken).catch(err => {
        console.error('發送密碼重設郵件失敗:', err);
      });
    }

    // 無論用戶是否存在，都回傳相同訊息
    return res.status(200).json({
      message: '如果此電子郵件已註冊，您將收到密碼重設郵件。請檢查您的收件匣。'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試。' });
  }
}
