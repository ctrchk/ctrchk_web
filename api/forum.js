// /api/forum.js
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

const VALID_TAGS = ['路線討論', '車站討論', '地點討論'];

function getAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res) {
  const user = getAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized: Valid token required' });
    return null;
  }
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action } = req.query;
    const currentUser = getAuth(req); // optional auth

    try {
      if (action === 'list_topics') {
        const { tag } = req.query;
        const params = [];
        let whereClause = '';
        if (tag) {
          params.push(tag);
          whereClause = `WHERE ft.tag = $${params.length}`;
        }

        const { rows: topics } = await query(
          `SELECT
             ft.id,
             ft.title,
             ft.tag,
             ft.user_id,
             u.full_name AS author_name,
             (u.user_role IN ('senior','admin')) AS is_senior,
             ft.view_count,
             COUNT(fr.id)::int AS reply_count,
             ft.created_at
           FROM forum_topics ft
           JOIN users u ON ft.user_id = u.id
           LEFT JOIN forum_replies fr ON ft.id = fr.topic_id
           ${whereClause}
           GROUP BY ft.id, u.full_name, u.user_role
           ORDER BY ft.created_at DESC`,
          params
        );
        return res.status(200).json({ topics });
      }

      if (action === 'get_topic') {
        const topicId = parseInt(req.query.id);
        if (!topicId) return res.status(400).json({ message: 'id is required' });

        await query(
          `UPDATE forum_topics SET view_count = view_count + 1 WHERE id = $1`,
          [topicId]
        );

        const { rows: topicRows } = await query(
          `SELECT
             ft.id,
             ft.title,
             ft.content,
             ft.tag,
             u.full_name AS author_name,
             (u.user_role IN ('senior','admin')) AS is_senior,
             ft.view_count,
             COUNT(fr.id)::int AS reply_count,
             ft.created_at
           FROM forum_topics ft
           JOIN users u ON ft.user_id = u.id
           LEFT JOIN forum_replies fr ON ft.id = fr.topic_id
           WHERE ft.id = $1
           GROUP BY ft.id, u.full_name, u.user_role`,
          [topicId]
        );

        if (topicRows.length === 0) {
          return res.status(404).json({ message: 'Topic not found' });
        }

        const repliesResult = await query(
          `SELECT
             fr.id,
             fr.content,
             u.full_name AS author_name,
             (u.user_role IN ('senior','admin')) AS is_senior,
             COUNT(rxn.id)::int AS reaction_count,
             fr.created_at
           FROM forum_replies fr
           JOIN users u ON fr.user_id = u.id
           LEFT JOIN forum_reactions rxn ON fr.id = rxn.reply_id
           WHERE fr.topic_id = $1
           GROUP BY fr.id, u.full_name, u.user_role
           ORDER BY fr.created_at ASC`,
          [topicId]
        );

        let replies = repliesResult.rows;

        if (currentUser) {
          const replyIds = replies.map(r => r.id);
          if (replyIds.length > 0) {
            const { rows: userReactions } = await query(
              `SELECT reply_id FROM forum_reactions WHERE user_id = $1 AND reply_id = ANY($2::int[])`,
              [currentUser.userId, replyIds]
            );
            const reactedSet = new Set(userReactions.map(r => r.reply_id));
            replies = replies.map(r => ({ ...r, user_reaction: reactedSet.has(r.id) }));
          } else {
            replies = replies.map(r => ({ ...r, user_reaction: false }));
          }
        }

        return res.status(200).json({ topic: topicRows[0], replies });
      }

      if (action === 'get_replies') {
        const topicId = parseInt(req.query.topic_id);
        if (!topicId) return res.status(400).json({ message: 'topic_id is required' });

        const { rows: replies } = await query(
          `SELECT
             fr.id,
             fr.content,
             u.full_name AS author_name,
             (u.user_role IN ('senior','admin')) AS is_senior,
             COUNT(rxn.id)::int AS reaction_count,
             fr.created_at
           FROM forum_replies fr
           JOIN users u ON fr.user_id = u.id
           LEFT JOIN forum_reactions rxn ON fr.id = rxn.reply_id
           WHERE fr.topic_id = $1
           GROUP BY fr.id, u.full_name, u.user_role
           ORDER BY fr.created_at ASC`,
          [topicId]
        );
        return res.status(200).json({ replies });
      }

      return res.status(400).json({ message: 'Invalid action' });

    } catch (error) {
      console.error('Forum GET error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;

    const { action } = req.query;

    try {
      if (action === 'create_topic') {
        const { title, content, tag } = req.body || {};

        if (!title || !content) {
          return res.status(400).json({ message: 'title and content are required' });
        }
        if (title.length > 100) {
          return res.status(400).json({ message: 'title must be 100 characters or fewer' });
        }
        if (content.length > 5000) {
          return res.status(400).json({ message: 'content must be 5000 characters or fewer' });
        }
        if (tag !== null && tag !== undefined && !VALID_TAGS.includes(tag)) {
          return res.status(400).json({ message: `tag must be one of: ${VALID_TAGS.join(', ')}` });
        }

        const { rows } = await query(
          `INSERT INTO forum_topics (user_id, title, content, tag)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, created_at`,
          [user.userId, title, content, tag || null]
        );
        return res.status(201).json({ topic: rows[0] });
      }

      if (action === 'create_reply') {
        const { topic_id, content } = req.body || {};

        if (!topic_id || !content) {
          return res.status(400).json({ message: 'topic_id and content are required' });
        }
        if (content.length > 2000) {
          return res.status(400).json({ message: 'content must be 2000 characters or fewer' });
        }

        const { rows: topicCheck } = await query(
          `SELECT id FROM forum_topics WHERE id = $1`,
          [topic_id]
        );
        if (topicCheck.length === 0) {
          return res.status(404).json({ message: 'Topic not found' });
        }

        const { rows } = await query(
          `INSERT INTO forum_replies (topic_id, user_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, content, created_at`,
          [topic_id, user.userId, content]
        );
        return res.status(201).json({ reply: rows[0] });
      }

      if (action === 'react') {
        if (!['senior', 'admin'].includes(user.role)) {
          return res.status(403).json({ message: 'Only senior or admin users can react to replies' });
        }

        const { reply_id } = req.body || {};
        if (!reply_id) {
          return res.status(400).json({ message: 'reply_id is required' });
        }

        const { rows: replyCheck } = await query(
          `SELECT id FROM forum_replies WHERE id = $1`,
          [reply_id]
        );
        if (replyCheck.length === 0) {
          return res.status(404).json({ message: 'Reply not found' });
        }

        const { rows: existing } = await query(
          `SELECT id FROM forum_reactions WHERE user_id = $1 AND reply_id = $2`,
          [user.userId, reply_id]
        );

        if (existing.length > 0) {
          await query(
            `DELETE FROM forum_reactions WHERE user_id = $1 AND reply_id = $2`,
            [user.userId, reply_id]
          );
          return res.status(200).json({ reacted: false, message: 'Reaction removed' });
        } else {
          await query(
            `INSERT INTO forum_reactions (user_id, reply_id) VALUES ($1, $2)`,
            [user.userId, reply_id]
          );
          return res.status(201).json({ reacted: true, message: 'Reaction added' });
        }
      }

      return res.status(400).json({ message: 'Invalid action' });

    } catch (error) {
      console.error('Forum POST error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const user = requireAuth(req, res);
    if (!user) return;

    const { action } = req.query;

    try {
      if (action === 'delete_topic') {
        if (user.role !== 'admin') {
          return res.status(403).json({ message: 'Only admins can delete topics' });
        }
        const topicId = parseInt(req.query.id);
        if (!topicId) return res.status(400).json({ message: 'id is required' });

        const { rowCount } = await query(
          `DELETE FROM forum_topics WHERE id = $1`,
          [topicId]
        );
        if (rowCount === 0) return res.status(404).json({ message: 'Topic not found' });
        return res.status(200).json({ message: `Topic ${topicId} deleted` });
      }

      if (action === 'delete_reply') {
        const replyId = parseInt(req.query.id);
        if (!replyId) return res.status(400).json({ message: 'id is required' });

        const { rows: replyRows } = await query(
          `SELECT user_id FROM forum_replies WHERE id = $1`,
          [replyId]
        );
        if (replyRows.length === 0) return res.status(404).json({ message: 'Reply not found' });

        if (user.role !== 'admin' && replyRows[0].user_id !== user.userId) {
          return res.status(403).json({ message: 'You can only delete your own replies' });
        }

        await query(`DELETE FROM forum_replies WHERE id = $1`, [replyId]);
        return res.status(200).json({ message: `Reply ${replyId} deleted` });
      }

      return res.status(400).json({ message: 'Invalid action' });

    } catch (error) {
      console.error('Forum DELETE error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
