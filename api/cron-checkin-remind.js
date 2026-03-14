// /api/cron-checkin-remind.js
// Vercel Cron Job: runs at 09:00 HKT (01:00 UTC) daily.
// Sends a Web Push check-in reminder to all subscribers who have
// a valid push subscription.
import { query } from './_db.js';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:admin@ctrchk.hk';
const CRON_SECRET       = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Verify Vercel cron secret (prevents unauthorised calls)
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

    if (!subs.length) {
      return res.status(200).json({ ok: true, sent: 0 });
    }

    const payload = JSON.stringify({
      title: '🗓️ 別忘了今日簽到！',
      body: '連續簽到可解鎖豐厚 XP 及里程幣獎勵，快來打卡吧！',
      url: '/tasks',
      tag: 'ctrc-checkin-reminder',
    });

    let sent = 0;
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
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    for (const ep of staleEndpoints) {
      await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [ep]).catch(() => {});
    }

    return res.status(200).json({ ok: true, sent });
  } catch (err) {
    console.error('cron-checkin-remind error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}
