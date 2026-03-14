// /api/push.js
// Single consolidated endpoint for all Web Push operations.
// Routing is done via HTTP method + optional ?action= query parameter.
//
//   GET  /api/push                        → return VAPID public key (public)
//   POST /api/push  { action:'subscribe' } → save push subscription
//   DELETE /api/push                       → remove push subscription
//   POST /api/push  { action:'send', ...}  → admin: send custom notification
//   GET  /api/push?action=cron-remind      → cron: daily check-in reminder
//
import { query } from './_db.js';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:admin@ctrchk.hk';
const CRON_SECRET       = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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

async function cleanStale(endpoints) {
  for (const ep of endpoints) {
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [ep]).catch(() => {});
  }
}

async function sendPushBatch(subs, payload) {
  let sent = 0, failed = 0;
  const stale = [];
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint);
    }
  }));
  await cleanStale(stale);
  return { sent, failed };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query?.action;

  // ── GET /api/push → return VAPID public key ────────────────────────────
  if (req.method === 'GET' && !action) {
    return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY || '' });
  }

  // ── GET /api/push?action=cron-remind → daily check-in reminder ─────────
  if (req.method === 'GET' && action === 'cron-remind') {
    if (CRON_SECRET) {
      const authHeader = req.headers.authorization || '';
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ message: 'Unauthorised' });
      }
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ message: 'Push service not configured' });
    }
    try {
      const { rows: subs } = await query(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions',
        []
      );
      if (!subs.length) return res.status(200).json({ ok: true, sent: 0 });
      const payload = JSON.stringify({
        title: '🗓️ 別忘了今日簽到！',
        body: '連續簽到可解鎖豐厚 XP 及里程幣獎勵，快來打卡吧！',
        url: '/tasks',
        tag: 'ctrc-checkin-reminder',
      });
      const { sent } = await sendPushBatch(subs, payload);
      return res.status(200).json({ ok: true, sent });
    } catch (err) {
      console.error('push cron-remind error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }

  // ── POST /api/push { action:'subscribe' } → save subscription ──────────
  if (req.method === 'POST' && (!action || action === 'subscribe')) {
    const body = req.body || {};
    if (body.action === 'subscribe' || !body.action) {
      const { subscription } = body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ message: '缺少 subscription' });
      }
      const user = getUserFromRequest(req);
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
        console.error('push subscribe error:', err);
        return res.status(500).json({ message: '伺服器錯誤' });
      }
    }
  }

  // ── POST /api/push { action:'send', ... } → admin custom push ──────────
  if (req.method === 'POST' && action === 'send') {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ message: '推送服務未配置（缺少 VAPID 金鑰）' });
    }
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ message: '未登入' });
    try {
      const { rows } = await query('SELECT user_role FROM users WHERE id = $1', [user.userId]);
      if (!rows.length || rows[0].user_role !== 'admin') {
        return res.status(403).json({ message: '無管理員權限' });
      }
    } catch (err) {
      console.error('push send role check error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
    const { title, body: msgBody, url, target_user_id, target_category } = req.body || {};
    if (!title || !msgBody) {
      return res.status(400).json({ message: '標題和內容為必填' });
    }
    try {
      let subs;
      if (target_user_id) {
        const { rows } = await query(
          'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
          [target_user_id]
        );
        subs = rows;
      } else if (target_category) {
        const { rows } = await query(
          `SELECT ps.endpoint, ps.p256dh, ps.auth
             FROM push_subscriptions ps
             JOIN users u ON u.id = ps.user_id
            WHERE u.user_role = $1`,
          [target_category]
        );
        subs = rows;
      } else {
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
        body: msgBody,
        url: url || '/',
        tag: 'ctrc-admin-push',
      });
      const { sent, failed } = await sendPushBatch(subs, payload);
      return res.status(200).json({ ok: true, sent, failed });
    } catch (err) {
      console.error('push send error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
  }

  // ── DELETE /api/push → remove subscription ─────────────────────────────
  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: '缺少 endpoint' });
    try {
      await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('push unsubscribe error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
