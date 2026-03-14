// /api/admin-push.js
// Admin endpoint to send custom Web Push notifications.
// Supports targeting: all users, a specific user ID, or a category.
import { query } from './_db.js';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:admin@ctrchk.hk';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function getAdminFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(503).json({ message: '推送服務未配置（缺少 VAPID 金鑰）' });
  }

  const user = getAdminFromRequest(req);
  if (!user) return res.status(401).json({ message: '未登入' });

  // Verify admin role from DB
  try {
    const { rows } = await query('SELECT user_role FROM users WHERE id = $1', [user.userId]);
    if (!rows.length || rows[0].user_role !== 'admin') {
      return res.status(403).json({ message: '無管理員權限' });
    }
  } catch (err) {
    console.error('admin-push role check error:', err);
    return res.status(500).json({ message: '伺服器錯誤' });
  }

  const { title, body, url, target_user_id, target_category } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ message: '標題和內容為必填' });
  }

  try {
    let subs;
    if (target_user_id) {
      // Send to a specific user
      const { rows } = await query(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
        [target_user_id]
      );
      subs = rows;
    } else if (target_category) {
      // Send to users with a specific tag in their profile (reserved for future use)
      // For now, treat category as user_role filter
      const { rows } = await query(
        `SELECT ps.endpoint, ps.p256dh, ps.auth
           FROM push_subscriptions ps
           JOIN users u ON u.id = ps.user_id
          WHERE u.user_role = $1`,
        [target_category]
      );
      subs = rows;
    } else {
      // Send to all subscribers
      const { rows } = await query(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions',
        []
      );
      subs = rows;
    }

    if (!subs.length) {
      return res.status(200).json({ ok: true, sent: 0, message: '沒有符合條件的訂閱者' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      tag: 'ctrc-admin-push',
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
        } catch (err) {
          failed++;
          // 410 Gone = subscription expired / revoked; clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up stale subscriptions
    for (const ep of staleEndpoints) {
      await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [ep]).catch(() => {});
    }

    return res.status(200).json({ ok: true, sent, failed });
  } catch (err) {
    console.error('admin-push error:', err);
    return res.status(500).json({ message: '伺服器錯誤' });
  }
}
