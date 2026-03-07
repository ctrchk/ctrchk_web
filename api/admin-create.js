// /api/admin-create.js
// 創建管理員帳戶（僅管理員可操作）
import { query } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 驗證管理員身份
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  try {
    const { email, full_name, password, role = 'admin' } = req.body;

    if (!email || !full_name || !password) {
      return res.status(400).json({ message: 'Email, name, and password are required' });
    }

    if (password.length < 12) {
      return res.status(400).json({ message: 'Admin password must be at least 12 characters' });
    }

    const validRoles = ['admin', 'senior'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // 檢查電郵是否已存在
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const salt = bcrypt.genSaltSync(12);
    const password_hash = bcrypt.hashSync(password, salt);

    await query(
      `INSERT INTO users (
        email, password_hash, user_role, full_name, profile_completed,
        auth_provider, email_verified
      ) VALUES ($1, $2, $3, $4, true, 'email', true)`,
      [email, password_hash, role, full_name]
    );

    return res.status(201).json({ 
      message: `${role === 'admin' ? '管理員' : '高級會員'}帳戶建立成功`,
      email,
      role
    });

  } catch (error) {
    console.error('Admin create error:', error);
    return res.status(500).json({ message: error.message });
  }
}
