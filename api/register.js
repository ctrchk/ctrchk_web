// /api/register.js
import { query } from './_db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail } from './_email.js';

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

    if (!full_name) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    // 確定高級會員資料欄位是否有填寫
    const premiumFields = [phone, experience, preferred_area];
    const premiumFilled = premiumFields.filter(v => v && String(v).trim() !== '');
    const hasPremiumData = premiumFilled.length > 0;

    // 若有填寫任一高級會員欄位，則必須全部填寫（除了 birthdate 和 bike_type 以外的必填欄位）
    if (hasPremiumData && premiumFilled.length < 3) {
      return res.status(400).json({ 
        message: '如需升級為高級會員，請填齊所有高級會員資料（電話、騎行經驗、騎行地區）。若暫時不升級，請清空所有高級會員欄位。' 
      });
    }

    // 處理多選地區（可能是陣列或逗號分隔字串）
    let preferredAreaStr = '';
    if (preferred_area) {
      if (Array.isArray(preferred_area)) {
        preferredAreaStr = preferred_area.join(',');
      } else {
        preferredAreaStr = String(preferred_area).trim();
      }
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

    // 產生電郵驗證 token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時後過期

    // 決定角色：有填高級會員資料 → senior，否則 → junior
    const userRole = hasPremiumData ? 'senior' : 'junior';
    const profileCompleted = hasPremiumData;

    // 插入新用戶
    const insertResult = await query(
      `INSERT INTO users (
        email, password_hash, user_role, full_name, phone,
        experience, preferred_area, birthdate, bike_type,
        profile_completed, profile_completion_date, auth_provider,
        email_verified, verification_token, verification_token_expiry
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${profileCompleted ? 'NOW()' : 'NULL'}, 'email', false, $11, $12
      ) RETURNING id`,
      [
        email, password_hash, userRole, full_name, phone || null,
        experience || null, preferredAreaStr || null,
        birthdate || null, bike_type || null,
        profileCompleted,
        verificationToken, verificationExpiry
      ]
    );

    const newUserId = insertResult.rows[0].id;

    // 發送驗證郵件（等待完成，確保在 Vercel serverless 環境中郵件能成功發出）
    try {
      await sendVerificationEmail(email, full_name, verificationToken);
    } catch (err) {
      console.error('發送驗證郵件失敗:', err);
      // 郵件發送失敗不影響註冊流程
    }

    // 自動登入：產生 JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error: JWT_SECRET not set' });
    }

    const token = jwt.sign(
      { 
        userId: newUserId, 
        email: email,
        role: userRole
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ 
      message: userRole === 'senior' 
        ? '註冊成功！您已成為高級會員。請查收驗證郵件以完成電郵驗證。' 
        : '註冊成功！請查收驗證郵件。您可在登入後補充資料以升級為高級會員。',
      token: token,
      user: {
        id: newUserId,
        email: email,
        full_name: full_name,
        user_role: userRole,
        role: userRole,
        profile_completed: profileCompleted,
        email_verified: false
      },
      user_role: userRole
    });

  } catch (error) {
    console.error('註冊 API 發生嚴重錯誤:', error); 
    return res.status(500).json({ message: error.message }); 
  }
}
