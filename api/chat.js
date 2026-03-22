// /api/chat.js
// 用戶聊天訊息 API
//
//   GET  /api/chat?action=conversations&user_id=X  → 列出對話列表（最近聯絡人）
//   GET  /api/chat?action=messages&user_id=X&peer_id=Y[&before=ID&limit=N]  → 取得對話訊息
//   GET  /api/chat?action=unread&user_id=X  → 未讀訊息總數
//   POST /api/chat  { sender_id, receiver_id, content }  → 發送訊息
//   POST /api/chat  { action: 'read', user_id, peer_id }  → 標記訊息為已讀
//   GET  /api/chat?action=users&user_id=X[&q=keyword]  → 搜尋可聊天用戶

import { query } from './_db.js';

// Simple JWT decode (no crypto verification; auth is expected on trusted infra)
function getUserIdFromToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || payload.user_id || payload.sub || null;
  } catch (_) {
    return null;
  }
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
      // ── 對話列表（最近聯絡人 + 最後一條訊息 + 未讀數）
      if (!action || action === 'conversations') {
        const { rows } = await query(
           `SELECT
              peer_id,
              COALESCE(u.username, u.full_name, u.email) AS peer_name,
              u.avatar_url AS peer_avatar,
              last_message,
              last_at,
             unread_count
           FROM (
             SELECT
               CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS peer_id,
               (ARRAY_AGG(content ORDER BY created_at DESC))[1] AS last_message,
               MAX(created_at) AS last_at,
               COUNT(*) FILTER (WHERE receiver_id = $1 AND is_read = FALSE) AS unread_count
             FROM chat_messages
             WHERE sender_id = $1 OR receiver_id = $1
             GROUP BY peer_id
           ) c
           JOIN users u ON u.id = c.peer_id
           ORDER BY last_at DESC
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

        const { rows } = await query(
           `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
                  COALESCE(su.username, su.full_name, su.email) AS sender_name, su.avatar_url AS sender_avatar
            FROM chat_messages m
            JOIN users su ON su.id = m.sender_id
           WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
             ${beforeId ? 'AND m.id < $4' : ''}
           ORDER BY m.created_at DESC
           LIMIT $3`,
          beforeId ? [uid, pid, msgLimit, beforeId] : [uid, pid, msgLimit]
        );
        return res.status(200).json(rows.reverse());
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
        let searchRows;
        if (keyword) {
          const { rows } = await query(
            `SELECT id, username, full_name, avatar_url FROM users
             WHERE id != $1 AND (username ILIKE $2 OR full_name ILIKE $2 OR email ILIKE $2) AND email_verified = TRUE AND username IS NOT NULL
             ORDER BY username LIMIT 20`,
            [uid, `%${keyword}%`]
          );
          searchRows = rows;
        } else {
          const { rows } = await query(
            `SELECT id, username, full_name, avatar_url FROM users
             WHERE id != $1 AND email_verified = TRUE AND username IS NOT NULL
             ORDER BY username LIMIT 30`,
            [uid]
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

      // ── 發送訊息
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
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Chat POST error:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
