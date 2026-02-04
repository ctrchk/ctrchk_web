// /api/google-auth.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { google_id, email, full_name } = req.body;

    if (!google_id || !email) {
      return res.status(400).json({ message: 'Google ID and email are required' });
    }

    // Check if user already exists
    const { rows } = await sql`
      SELECT * FROM users WHERE google_id = ${google_id} OR email = ${email}
    `;
    
    if (rows.length > 0) {
      // User exists, return existing user info
      return res.status(200).json({ 
        message: 'User already exists',
        user: {
          id: rows[0].id,
          email: rows[0].email,
          user_role: rows[0].user_role,
          profile_completed: rows[0].profile_completed
        }
      });
    }

    // Create new user as junior member
    const insertResult = await sql`
      INSERT INTO users (
        email,
        google_id,
        full_name,
        user_role,
        auth_provider,
        profile_completed
      )
      VALUES (
        ${email},
        ${google_id},
        ${full_name || null},
        'junior',
        'google',
        false
      )
      RETURNING id, email, user_role, profile_completed
    `;

    return res.status(201).json({ 
      message: 'User created as junior member',
      user: insertResult.rows[0]
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ message: error.message });
  }
}
