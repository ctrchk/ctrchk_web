// /api/getHistory.js
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// 這是一個通用的中介軟體函數，用於驗證 Token
async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing or invalid' });
    return null; // 表示驗證失敗
  }
  
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // 返回解碼後的用戶資訊
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null; // 表示驗證失敗
  }
}

export default async function handler(req, res) {
  // 1. 驗證用戶
  const userData = await authenticate(req, res);
  
  // 如果 authenticate 已經發送了錯誤回應，userData 會是 null
  if (!userData) {
    return; 
  }

  // 2. 驗證通過，userData 包含 { userId, email, role }
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`
        SELECT id, ride_date, distance_km 
        FROM cycling_history 
        WHERE user_id = ${userData.userId}
        ORDER BY ride_date DESC
      `;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to fetch history' });
    }
  } 
  
  // 你也可以在這裡處理 POST 請求，例如新增一筆紀錄
  else if (req.method === 'POST') {
     // const { ride_date, distance_km } = req.body;
     // ... 執行 INSERT ...
     return res.status(405).json({ message: 'POST not implemented yet' });
  } 
  
  else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
