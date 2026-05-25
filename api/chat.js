
// /api/chat.js
// 用戶聊天訊息 API
//
//   GET  /api/chat?action=conversations&user_id=X  → 列出對話列表（最近聯絡人）
//   GET  /api/chat?action=messages&user_id=X&peer_id=Y[&before=ID&limit=N]  → 取得對話訊息
//   GET  /api/chat?action=unread&user_id=X  → 未讀訊息總數
//   POST /api/chat  { sender_id, receiver_id, content }  → 發送訊息
//   POST /api/chat  { action: 'read', user_id, peer_id }  → 標記訊息為已讀
//   GET  /api/chat?action=users&user_id=X[&q=keyword]  → 搜尋可聊天用戶

import { query } from '../lib/db.js';
import { sendPushToUser } from '../lib/push-helper.js';

// Simple JWT decode (no crypto verification; auth is expected on trusted infra)
function decodeJwtPayload(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload || null;
  } catch (_) {
    return null;
  }
}

function getUserIdFromToken(req) {
  const payload = decodeJwtPayload(req);
  return payload ? (payload.userId || payload.user_id || payload.sub || null) : null;
}

function getUserRoleFromToken(req) {
  const payload = decodeJwtPayload(req);
  return payload ? (payload.role || payload.user_role || null) : null;
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, user_id, peer_id, q, before, limit } = req.query;
    const uid = parseInt(user_id, 10);
    if (!uid) return res.status(400).json({ message: 'user_id required' });

    try {
      // ── 客服 threads：取得列表
      if (action === 'support_threads') {
        const role = getUserRoleFromToken(req);
        if (role !== 'senior_admin') {
          const { rows } = await query(
            `SELECT id, user_id, claimed_by_admin_id, status, created_at, updated_at
             FROM support_threads
             WHERE user_id = $1
             ORDER BY updated_at DESC
             LIMIT 20`,
            [uid]
          );
          return res.status(200).json({ threads: rows });
        }

        const { rows } = await query(
          `SELECT id, user_id, claimed_by_admin_id, status, created_at, updated_at
           FROM support_threads
           ORDER BY status ASC, updated_at DESC
           LIMIT 50`
        );
        return res.status(200).json({ threads: rows });
      }

      // ── 客服 threads：取得某 thread 訊息
      if (action === 'support_messages') {
        const threadId = parseInt(req.query.thread_id, 10);
        if (!threadId) return res.status(400).json({ message: 'thread_id required' });

        const role = getUserRoleFromToken(req);
        const isAdmin = role === 'senior_admin';

        if (!isAdmin) {
          const { rows: trows } = await query(
            `SELECT id FROM support_threads WHERE id = $1 AND user_id = $2`,
            [threadId, uid]
          );
          if (!trows.length) return res.status(404).json({ message: 'Thread not found' });
        }

        const { rows } = await query(
          `SELECT id, sender_id, receiver_id, content, is_read, created_at, thread_id
           FROM chat_messages
           WHERE thread_id = $1
           ORDER BY created_at ASC
           LIMIT 200`,
          [threadId]
        );
        return res.status(200).json({ messages: rows });
      }

      // ── 對話列表（最近聯絡人 + 最後一條訊息 + 未讀數）
      if (!action || action === 'conversations') {
        const { rows } = await query(
          `SELECT
             peers.peer_id,
             COALESCE(u.username, u.full_name, u.email) AS peer_name,
             u.avatar_url AS peer_avatar,
             last_msg.content AS last_message,
             last_msg.created_at AS last_at,
             COALESCE(unread.cnt, 0) AS unread_count
           FROM (
             SELECT DISTINCT
               CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer_id
             FROM chat_messages
             WHERE sender_id = $1 OR receiver_id = $1
           ) peers
           JOIN LATERAL (
             SELECT content, created_at
             FROM chat_messages
             WHERE (sender_id = $1 AND receiver_id = peers.peer_id)
                OR (sender_id = peers.peer_id AND receiver_id = $1)
             ORDER BY created_at DESC
             LIMIT 1
           ) last_msg ON TRUE
           LEFT JOIN LATERAL (
             SELECT COUNT(*) AS cnt
             FROM chat_messages
             WHERE receiver_id = $1 AND sender_id = peers.peer_id AND is_read = FALSE
           ) unread ON TRUE
           JOIN users u ON u.id = peers.peer_id
           ORDER BY last_msg.created_at DESC
           LIMIT 50`,
          [uid]
        );
        return res.status(200).json(rows);
      }


      // ── 訊息記錄
      if (action === 'messages') {
        const pid = parseInt(peer_id, 10);
        if (!pid) return res.status(400).json({ message: 'peer_id required' });
        const msgLimit = Math.min(parseInt(limit, 10) || 40, 100);
        const beforeId = parseInt(before, 10) || null;
        const afterId = parseInt(req.query.after, 10) || null;

        let sql, params;
        if (afterId) {
          // Polling path: only return messages newer than afterId (already in ASC order)
          sql = `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
                        COALESCE(su.username, su.full_name, su.email) AS sender_name, su.avatar_url AS sender_avatar
                 FROM chat_messages m
                 JOIN users su ON su.id = m.sender_id
                WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
                  AND m.id > $3
                ORDER BY m.created_at ASC
                LIMIT $4`;
          params = [uid, pid, afterId, msgLimit];
        } else {
          // Initial load / load-more path: return newest N messages in ASC order
          sql = `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
                        COALESCE(su.username, su.full_name, su.email) AS sender_name, su.avatar_url AS sender_avatar
                 FROM chat_messages m
                 JOIN users su ON su.id = m.sender_id
                WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
                  ${beforeId ? 'AND m.id < $4' : ''}
                ORDER BY m.created_at DESC
                LIMIT $3`;
          params = beforeId ? [uid, pid, msgLimit, beforeId] : [uid, pid, msgLimit];
        }

        const { rows } = await query(sql, params);
        // afterId (polling) path returns rows already in ASC order from the DB.
        // Initial/before-load path fetches DESC then reverses to give ASC to the caller.
        return res.status(200).json(afterId ? rows : rows.reverse());
      }

      // ── 未讀訊息數
      if (action === 'unread') {
        const { rows } = await query(
          `SELECT COUNT(*) AS count FROM chat_messages WHERE receiver_id = $1 AND is_read = FALSE`,
          [uid]
        );
        return res.status(200).json({ unread: parseInt(rows[0].count, 10) });
      }

      // ── 搜尋用戶
      if (action === 'users') {
        const keyword = (q || '').trim();
        if (keyword.length < 2) {
          return res.status(200).json([]);
        }
        let searchRows;
        if (keyword) {
          const { rows } = await query(
            `SELECT id, username, full_name, avatar_url FROM users
             WHERE id != $1 AND (username ILIKE $2 OR full_name ILIKE $2 OR email ILIKE $2) AND email_verified = TRUE AND username IS NOT NULL
             ORDER BY username LIMIT 20`,
            [uid, `%${keyword}%`]
          );
          searchRows = rows;
        }
        return res.status(200).json(searchRows);
      }

      if (action === 'start_chat') {
        const target = String(req.query.target || '').trim();
        if (!/^[A-Za-z0-9_]{4,16}$/.test(target)) {
          return res.status(400).json({ message: 'Invalid username' });
        }
        const { rows } = await query(
          `SELECT id, username, full_name, avatar_url
             FROM users
            WHERE id != $1
              AND email_verified = TRUE
              AND LOWER(username) = LOWER($2)
            LIMIT 1`,
          [uid, target]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        return res.status(200).json(rows[0]);
      }

      return res.status(400).json({ message: 'Unknown action' });
    } catch (err) {
      console.error('Chat GET error:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, sender_id, receiver_id, user_id, peer_id, content } = req.body || {};

    try {
      // ── 標記已讀
      if (action === 'read') {
        const uid = parseInt(user_id, 10);
        const pid = parseInt(peer_id, 10);
        if (!uid || !pid) return res.status(400).json({ message: 'user_id and peer_id required' });
        await query(
          `UPDATE chat_messages SET is_read = TRUE
           WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE`,
          [uid, pid]
        );
        return res.status(200).json({ message: 'Marked as read' });
      }

      // ── 客服：建立 thread（user → support）
      if (action === 'start_support_thread') {
        const text = String(content || '').trim();
        const uid2 = parseInt(user_id, 10);
        if (!uid2) return res.status(400).json({ message: 'user_id required' });

        if (!text) {
          // 預設首訊息內容
          const defaultText = '客服人數有限 您可以先離開此頁面 我們將會儘快回復您 請耐心等候 您亦可選擇discord内的客服';
          return await (async () => {
            const { rows: adminRows } = await query(
              `SELECT id FROM users WHERE user_role = 'senior_admin' ORDER BY id ASC`
            );
            if (!adminRows.length) {
              return res.status(503).json({ message: 'No senior_admin available' });
            }

            // 建立 thread（每次 user 點客服都建新 thread；如需合併可再改）
            const { rows: tRows } = await query(
              `INSERT INTO support_threads (user_id, status)
               VALUES ($1, 'open')
               RETURNING id, user_id, claimed_by_admin_id, status, created_at, updated_at`,
              [uid2]
            );
            const threadId = tRows[0]?.id;

            await query(
              `INSERT INTO chat_messages (sender_id, receiver_id, content, thread_id)
               VALUES ($1, $2, $3, $4)`,
              [uid2, adminRows[0].id, defaultText, threadId]
            );

            // 對所有 senior_admin 都推送通知（receiver 以每個 admin 的 id）
            const MAX_PUSH_PREVIEW_LENGTH = 80;
            const preview = defaultText.length > MAX_PUSH_PREVIEW_LENGTH ? defaultText.slice(0, MAX_PUSH_PREVIEW_LENGTH) + '…' : defaultText;
            await Promise.all(
              adminRows.map((a) =>
                sendPushToUser(a.id, {
                  title: '有新客服需求',
                  body: preview,
                  url: `/chat?support=1&thread_id=${threadId}`,
                  tag: `ctrc-support-${threadId}-${a.id}`,
                })
              )
            ).catch(() => {});

            return res.status(201).json({ thread_id: threadId });
          })();
        }


        // 有內容時同樣建立 thread 並寫入首訊息
        const { rows: adminRows } = await query(
          `SELECT id FROM users WHERE user_role = 'senior_admin' ORDER BY id ASC`
        );
        if (!adminRows.length) {
          return res.status(503).json({ message: 'No senior_admin available' });
        }

        const { rows: tRows } = await query(
          `INSERT INTO support_threads (user_id, status)
           VALUES ($1, 'open')
           RETURNING id, user_id, claimed_by_admin_id, status, created_at, updated_at`,
          [uid2]
        );
        const threadId = tRows[0]?.id;

        await query(
          `INSERT INTO chat_messages (sender_id, receiver_id, content, thread_id)
           VALUES ($1, $2, $3, $4)`,
          [uid2, adminRows[0].id, text, threadId]
        );

        const MAX_PUSH_PREVIEW_LENGTH = 80;
        const preview = text.length > MAX_PUSH_PREVIEW_LENGTH ? text.slice(0, MAX_PUSH_PREVIEW_LENGTH) + '…' : text;
        await Promise.all(
          adminRows.map((a) =>
            sendPushToUser(a.id, {
              title: '有新客服需求',
              body: preview,
              url: `/chat?support=1&thread_id=${threadId}`,
              tag: `ctrc-support-${threadId}-${a.id}`,
            })
          )
        ).catch(() => {});

        return res.status(201).json({ thread_id: threadId });
      }

      // ── 客服：claim（senior_admin）
      if (action === 'support_claim') {
        const adminId = parseInt(user_id, 10);
        const threadId = parseInt(req.body.thread_id, 10);
        const role = getUserRoleFromToken(req);
        if (!adminId || !threadId) return res.status(400).json({ message: 'user_id and thread_id required' });
        if (role !== 'senior_admin') return res.status(403).json({ message: 'Forbidden: senior_admin only' });

        const { rows } = await query(
          `UPDATE support_threads
           SET claimed_by_admin_id = COALESCE(claimed_by_admin_id, $1),
               status = CASE WHEN claimed_by_admin_id IS NULL THEN 'claimed' ELSE status END,
               updated_at = NOW()
           WHERE id = $2 AND status IN ('open','claimed')
           RETURNING id, claimed_by_admin_id, status`,
          [adminId, threadId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Thread not found' });

        const claimedAdminId = rows[0].claimed_by_admin_id;
        if (claimedAdminId !== adminId) {
          return res.status(409).json({ message: 'Already claimed by other admin', claimed_by_admin_id: claimedAdminId });
        }
        return res.status(200).json({ message: 'Claimed', claimed_by_admin_id: adminId, thread_id: threadId });
      }

      // ── 客服：回覆（只有 claimed 的 senior_admin 可送）
      if (action === 'support_send') {
        const adminId = parseInt(user_id, 10);
        const threadId = parseInt(req.body.thread_id, 10);
        const text = String(content || '').trim();
        const role = getUserRoleFromToken(req);
        if (!adminId || !threadId) return res.status(400).json({ message: 'user_id and thread_id required' });
        if (role !== 'senior_admin') return res.status(403).json({ message: 'Forbidden: senior_admin only' });
        if (!text) return res.status(400).json({ message: 'Message content required' });
        if (text.length > 2000) return res.status(400).json({ message: 'Message too long (max 2000 chars)' });

        const { rows: tRows } = await query(
          `SELECT claimed_by_admin_id, user_id FROM support_threads WHERE id = $1`,
          [threadId]
        );
        if (!tRows.length) return res.status(404).json({ message: 'Thread not found' });
        const thread = tRows[0];

        if (thread.claimed_by_admin_id !== adminId) {
          return res.status(403).json({ message: 'Forbidden: this thread is claimed by other admin' });
        }

        // 寫入訊息（receiver 以 thread user_id 為目標，且 thread_id 綁定）
        const { rows: msgRows } = await query(
          `INSERT INTO chat_messages (sender_id, receiver_id, content, thread_id, is_read)
           VALUES ($1, $2, $3, $4, FALSE)
           RETURNING id, sender_id, receiver_id, content, is_read, created_at, thread_id`,
          [adminId, thread.user_id, text, threadId]
        );

        // push 给 user
        const MAX_PUSH_PREVIEW_LENGTH = 80;
        const preview = text.length > MAX_PUSH_PREVIEW_LENGTH ? text.slice(0, MAX_PUSH_PREVIEW_LENGTH) + '…' : text;
        sendPushToUser(thread.user_id, {
          title: '客服回覆',
          body: preview,
          url: `/chat?support=1&thread_id=${threadId}`,
          tag: `ctrc-support-user-${threadId}-${thread.user_id}`,
        }).catch(() => {});

        return res.status(201).json(msgRows[0]);
      }

      // ── 發送訊息（原本一般聊天）
      const sid = parseInt(sender_id, 10);
      const rid = parseInt(receiver_id, 10);
      if (!sid || !rid) return res.status(400).json({ message: 'sender_id and receiver_id required' });
      if (sid === rid) return res.status(400).json({ message: 'Cannot send message to yourself' });
      const text = (content || '').trim();
      if (!text) return res.status(400).json({ message: 'Message content required' });
      if (text.length > 2000) return res.status(400).json({ message: 'Message too long (max 2000 chars)' });

      const { rows } = await query(
        `INSERT INTO chat_messages (sender_id, receiver_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, receiver_id, content, is_read, created_at`,
        [sid, rid, text]
      );


      // Fire push notification to receiver (non-blocking)
      const MAX_PUSH_PREVIEW_LENGTH = 80;
      query(
        `SELECT COALESCE(username, full_name, email) AS display_name FROM users WHERE id = $1`,
        [sid]
      ).then(({ rows: senderRows }) => {
        const senderName = senderRows[0]?.display_name || '新訊息';
        const preview = text.length > MAX_PUSH_PREVIEW_LENGTH ? text.slice(0, MAX_PUSH_PREVIEW_LENGTH) + '…' : text;
        return sendPushToUser(rid, {
          title: senderName,
          body: preview,
          url: `/chat?peer=${sid}`,
          tag: `ctrc-chat-${sid}`,
        });
      }).catch(() => {});

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Chat POST error:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
