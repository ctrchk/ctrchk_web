// /api/get-user.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { google_id, email, user_id } = req.query;

    if (!google_id && !email && !user_id) {
      return res.status(400).json({ message: 'User identifier required (google_id, email, or user_id)' });
    }

    let result;

    if (google_id) {
      result = await sql`
        SELECT id, email, user_role, full_name, phone, profile_completed, auth_provider, created_at 
        FROM users 
        WHERE google_id = ${google_id}
      `;
    } else if (user_id) {
      result = await sql`
        SELECT id, email, user_role, full_name, phone, profile_completed, auth_provider, created_at 
        FROM users 
        WHERE id = ${user_id}
      `;
    } else {
      result = await sql`
        SELECT id, email, user_role, full_name, phone, profile_completed, auth_provider, created_at 
        FROM users 
        WHERE email = ${email}
      `;
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: error.message });
  }
}
