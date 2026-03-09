// /api/blog.js
import { query } from './_db.js';
import jwt from 'jsonwebtoken';

function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: Missing token' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    res.status(500).json({ message: 'Server configuration error' });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
      return null;
    }
    return decoded;
  } catch {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { id } = req.query;

      if (id) {
        const postId = parseInt(id);
        if (!postId) return res.status(400).json({ message: 'Invalid id' });

        const { rows } = await query(
          `SELECT
             bp.id,
             bp.title,
             bp.summary,
             bp.content,
             bp.image_url,
             u.full_name AS author_name,
             bp.created_at,
             bp.updated_at
           FROM blog_posts bp
           JOIN users u ON bp.author_id = u.id
           WHERE bp.id = $1`,
          [postId]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });
        return res.status(200).json({ post: rows[0] });
      }

      // List all published posts
      const { rows: posts } = await query(
        `SELECT
           bp.id,
           bp.title,
           bp.summary,
           bp.image_url,
           u.full_name AS author_name,
           bp.created_at
         FROM blog_posts bp
         JOIN users u ON bp.author_id = u.id
         ORDER BY bp.created_at DESC`
      );
      return res.status(200).json({ posts });

    } catch (error) {
      console.error('Blog GET error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    try {
      const { title, summary, content, image_url } = req.body || {};

      if (!title || !content) {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const { rows } = await query(
        `INSERT INTO blog_posts (author_id, title, summary, content, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title`,
        [admin.userId, title, summary || null, content, image_url || null]
      );
      return res.status(201).json({ post: rows[0] });

    } catch (error) {
      console.error('Blog POST error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    try {
      const postId = parseInt(req.query.id);
      if (!postId) return res.status(400).json({ message: 'id is required' });

      const { title, summary, content, image_url } = req.body || {};

      if (!title || !content) {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const { rows, rowCount } = await query(
        `UPDATE blog_posts
         SET title = $1, summary = $2, content = $3, image_url = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING id, title`,
        [title, summary || null, content, image_url || null, postId]
      );

      if (rowCount === 0) return res.status(404).json({ message: 'Post not found' });
      return res.status(200).json({ post: rows[0] });

    } catch (error) {
      console.error('Blog PUT error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    try {
      const postId = parseInt(req.query.id);
      if (!postId) return res.status(400).json({ message: 'id is required' });

      const { rowCount } = await query(
        `DELETE FROM blog_posts WHERE id = $1`,
        [postId]
      );

      if (rowCount === 0) return res.status(404).json({ message: 'Post not found' });
      return res.status(200).json({ message: `Post ${postId} deleted` });

    } catch (error) {
      console.error('Blog DELETE error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
