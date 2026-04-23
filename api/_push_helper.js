// api/_push_helper.js
// Shared helper: send Web Push notifications to a specific user.
// Used by chat.js (and any future feature) to avoid duplicating VAPID/webpush logic.

import webpush from 'web-push';
import { query } from './_db.js';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:admin@ctrchk.hk';

let vapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

/**
 * Send a Web Push notification to all subscriptions of a given user.
 *
 * @param {number} userId  - recipient's user id
 * @param {object} payload - { title, body, url, tag }
 * @returns {Promise<void>}  resolves when all attempts are settled (errors are swallowed)
 */
export async function sendPushToUser(userId, payload) {
  if (!vapidConfigured) return;
  if (!userId) return;

  let subs;
  try {
    const { rows } = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    subs = rows;
  } catch (_) {
    return;
  }

  if (!subs.length) return;

  const data = JSON.stringify(payload);
  const stale = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(sub.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions (fire-and-forget)
  for (const ep of stale) {
    query('DELETE FROM push_subscriptions WHERE endpoint = $1', [ep]).catch(() => {});
  }
}
