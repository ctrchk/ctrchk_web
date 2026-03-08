// /api/login.js
import { query } from './_db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid credentials' }); // 安全起見，不提示用戶不存在
    }

    const user = rows[0];

    // 若帳號沒有設定密碼（例如純 Google 帳號），拒絕密碼登入
    if (!user.password_hash) {
      return res.status(401).json({ message: '此帳號使用 Google 登入，請改用 Google 登入按鈕。' });
    }

    const isPasswordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 從環境變數讀取 SECRET
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not set in environment variables');
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.user_role || user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' } // Token 有效期 7 天
    );

    return res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name || '',
        user_role: user.user_role || 'junior',
        role: user.user_role || user.role,
        profile_completed: user.profile_completed || false,
        email_verified: user.email_verified || false
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
