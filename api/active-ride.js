import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';

async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing or invalid' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers for PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userData = await authenticate(req, res);
  if (!userData) return;

  if (req.method === 'GET') {
    try {
      const { rows } = await query('SELECT state FROM active_rides WHERE user_id = $1', [userData.userId]);
      if (rows.length === 0) {
        return res.status(200).json({ state: null });
      }
      return res.status(200).json({ state: rows[0].state });
    } catch (error) {
      console.error('[active-ride GET] error:', error);
      return res.status(500).json({ message: 'Failed to fetch active ride' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { state } = req.body || {};
      if (!state) {
        return res.status(400).json({ message: 'State is required' });
      }
      await query(
        `INSERT INTO active_rides (user_id, state, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
        [userData.userId, JSON.stringify(state)]
      );
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[active-ride POST] error:', error);
      return res.status(500).json({ message: 'Failed to sync active ride' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM active_rides WHERE user_id = $1', [userData.userId]);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[active-ride DELETE] error:', error);
      return res.status(500).json({ message: 'Failed to clear active ride' });
    }
  }

  return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}
