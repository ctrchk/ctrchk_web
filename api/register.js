// /api/register.js (偵錯修正版)
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Email and password (min 8 chars) are required' });
    }

    // 檢查用戶是否已存在
    const { rows } = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;
    if (rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // 將密碼加密 (hashing)
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    // 插入新用戶
    await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${password_hash})
    `;

    return res.status(201).json({ message: 'User created successfully' });

  } catch (error) {
    console.error('註冊 API 發生嚴重錯誤:', error); 
    
    // 將資料庫的原始錯誤訊息回傳給前端
    return res.status(500).json({ message: error.message }); 
  }
}
