// /api/password-reset.js
// 忘記密碼 + 重設密碼 — 合併為單一端點以節省 Vercel Serverless Function 配額
//
// POST /api/password-reset
//   { email }                 → 忘記密碼：生成 token 並寄送重設郵件
//   { token, password }       → 重設密碼：驗證 token 並更新新密碼
//
import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../lib/email.js';

export default async function handler(req, res) {
  const action = req.query.action;

  // ── 電郵驗證（由 /api/verify-email rewrite 到本端點）─────────────────────
  if (action === 'verify-email') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
    try {
      const token = req.query.token || req.body?.token;
      if (!token) return res.status(400).json({ message: '缺少驗證 token' });

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
      if (user.verification_token_expiry && new Date() > new Date(user.verification_token_expiry)) {
        return res.status(400).json({
          message: '驗證連結已過期（超過 24 小時）。請重新申請驗證郵件。',
          expired: true
        });
      }

      await query(
        `UPDATE users
           SET email_verified = true, verification_token = NULL, verification_token_expiry = NULL
         WHERE id = $1`,
        [user.id]
      );
      sendWelcomeEmail(user.email, user.full_name).catch(err => {
        console.error('發送歡迎郵件失敗:', err);
      });

      return res.status(200).json({
        message: '電郵驗證成功！歡迎加入城市運輸單車。',
        email: user.email
      });
    } catch (error) {
      console.error('Email verification error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, token, password } = req.body || {};

  // ── 重設密碼（步驟 2）：提供 token + password ──────────────────────────
  if (token && password) {
    try {
      if (password.length < 8) {
        return res.status(400).json({ message: '密碼長度至少需要 8 個字元' });
      }

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

      if (!user.password_reset_token_expiry || new Date() > new Date(user.password_reset_token_expiry)) {
        return res.status(400).json({
          message: '重設連結已過期（超過 1 小時），請重新申請忘記密碼。',
          expired: true
        });
      }

      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(password, salt);

      await query(
        `UPDATE users
            SET password_hash = $1,
                password_reset_token = NULL,
                password_reset_token_expiry = NULL,
                email_verified = true
          WHERE id = $2`,
        [password_hash, user.id]
      );

      return res.status(200).json({ message: '密碼已成功重設！請使用新密碼登入。' });

    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試。' });
    }
  }

  // ── 忘記密碼（步驟 1）：提供 email ──────────────────────────────────────
  if (email) {
    try {
      const { rows } = await query(
        'SELECT id, email, full_name, auth_provider FROM users WHERE email = $1',
        [email]
      );

      if (rows.length > 0) {
        const user = rows[0];

        // 純 Google 帳號不支援密碼登入，跳過 token 生成（仍回傳相同訊息防止帳號枚舉）
        if (user.auth_provider !== 'google') {
          const resetToken = crypto.randomBytes(32).toString('hex');
          const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 小時

          await query(
            `UPDATE users
               SET password_reset_token = $1, password_reset_token_expiry = $2
             WHERE id = $3`,
            [resetToken, resetExpiry, user.id]
          );

          await sendPasswordResetEmail(user.email, user.full_name, resetToken).catch(err => {
            console.error('發送密碼重設郵件失敗:', err);
          });
        }
      }

      // 無論用戶是否存在都回傳相同訊息（防止帳號枚舉攻擊）
      return res.status(200).json({
        message: '如果此電子郵件已註冊，您將收到密碼重設郵件。請檢查您的收件匣。'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試。' });
    }
  }

  // ── 缺少必要參數 ─────────────────────────────────────────────────────────
  return res.status(400).json({ message: '缺少必要參數（email 或 token + password）' });
}
