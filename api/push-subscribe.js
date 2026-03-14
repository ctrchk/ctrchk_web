// /api/push-subscribe.js
// Saves a Web Push subscription for a user, or removes it (DELETE).
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = getUserFromRequest(req);

  if (req.method === 'POST') {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: '缺少 subscription' });
    }

    try {
      await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id    = EXCLUDED.user_id,
               p256dh     = EXCLUDED.p256dh,
               auth       = EXCLUDED.auth,
               updated_at = NOW()`,
        [
          user?.userId || null,
          subscription.endpoint,
          subscription.keys?.p256dh || null,
          subscription.keys?.auth || null,
        ]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('push-subscribe POST error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: '缺少 endpoint' });
    try {
      await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('push-subscribe DELETE error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
