// /api/register.js
import { query } from './db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { 
      email, 
      password, 
      full_name, 
      phone, 
      experience, 
      preferred_area,
      birthdate,
      bike_type 
    } = req.body;

    // Validate required fields
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Email and password (min 8 chars) are required' });
    }

    if (!full_name || !phone || !experience || !preferred_area) {
      return res.status(400).json({ message: 'All required profile fields must be filled' });
    }

    // 檢查用戶是否已存在
    const { rows } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // 將密碼加密 (hashing)
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    // 插入新用戶，直接設為高級會員（senior）
    await query(
      `INSERT INTO users (
        email, password_hash, user_role, full_name, phone,
        experience, preferred_area, birthdate, bike_type,
        profile_completed, profile_completion_date, auth_provider
      ) VALUES (
        $1, $2, 'senior', $3, $4, $5, $6, $7, $8, true, NOW(), 'email'
      )`,
      [email, password_hash, full_name, phone, experience, preferred_area,
       birthdate || null, bike_type || null]
    );

    return res.status(201).json({ 
      message: 'User created successfully as senior member',
      user_role: 'senior'
    });

  } catch (error) {
    console.error('註冊 API 發生嚴重錯誤:', error); 
    
    // 將資料庫的原始錯誤訊息回傳給前端
    return res.status(500).json({ message: error.message }); 
  }
}
