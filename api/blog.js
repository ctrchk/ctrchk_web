// /api/blog.js
import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';

function requireAuth(req, res) {
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
    return decoded;
  } catch {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
    return null;
  }
}

function requireAdmin(req, res) {
  const decoded = requireAuth(req, res);
  if (!decoded) return null;
  if (decoded.role !== 'senior_admin') {
    res.status(403).json({ message: 'Forbidden: Senior admin access required' });
    return null;
  }
  return decoded;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { id, action } = req.query;

      // View own submissions history
      if (action === 'my_history') {
        const user = requireAuth(req, res);
        if (!user) return;
        const { rows: posts } = await query(
          `SELECT id, title, summary, published, created_at
           FROM blog_posts
           WHERE author_id = $1
           ORDER BY created_at DESC`,
          [user.userId]
        );
        return res.status(200).json({ posts });
      }

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
             COALESCE(u.full_name, '管理員') AS author_name,
             bp.created_at,
             bp.updated_at,
             bp.published
           FROM blog_posts bp
           LEFT JOIN users u ON bp.author_id = u.id
           WHERE bp.id = $1`,
          [postId]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Post not found' });

        // Non-admins can only view published posts unless it's their own
        const post = rows[0];
        if (!post.published) {
            const user = requireAuth(req, res);
            if (!user) return;

            // If not logged in or not admin and not author
            const isAdmin = user.role === 'senior_admin';
            const isAuthor = user.userId === post.author_id;
            if (!isAdmin && !isAuthor) {
                return res.status(403).json({ message: 'Post is not published yet' });
            }
        }
        return res.status(200).json({ post });
      }

      // List all published posts
      const { rows: posts } = await query(
        `SELECT
           bp.id,
           bp.title,
           bp.summary,
           bp.image_url,
           COALESCE(u.full_name, '管理員') AS author_name,
           bp.created_at
         FROM blog_posts bp
         LEFT JOIN users u ON bp.author_id = u.id
         WHERE bp.published = TRUE
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
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const { title, summary, content, image_url } = req.body || {};

      if (!title || !content) {
        return res.status(400).json({ message: 'title and content are required' });
      }

      // Non-admins post as unpublished
      const is_admin = user.role === 'senior_admin';
      const published = is_admin ? true : false;

      const { rows } = await query(
        `INSERT INTO blog_posts (author_id, title, summary, content, image_url, published)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, published`,
        [user.userId, title, summary || null, content, image_url || null, published]
      );
      return res.status(201).json({
        post: rows[0],
        message: is_admin ? '文章已發布' : '文章已提交，請等待管理員審核。'
      });

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

      const { title, summary, content, image_url, published } = req.body || {};

      if (!title || !content) {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const { rows, rowCount } = await query(
        `UPDATE blog_posts
         SET title = $1, summary = $2, content = $3, image_url = $4, published = COALESCE($5, published), updated_at = NOW()
         WHERE id = $6
         RETURNING id, title`,
        [title, summary || null, content, image_url || null, published, postId]
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
