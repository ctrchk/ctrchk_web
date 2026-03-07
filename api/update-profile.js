// /api/update-profile.js
import { query } from './db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { 
      user_id,
      google_id,
      email,
      full_name, 
      phone, 
      experience, 
      preferred_area,
      birthdate,
      bike_type 
    } = req.body;

    // Validate required fields
    if (!full_name || !phone || !experience || !preferred_area) {
      return res.status(400).json({ message: 'All required profile fields must be filled' });
    }

    // Need either user_id, google_id, or email to identify the user
    if (!user_id && !google_id && !email) {
      return res.status(400).json({ message: 'User identifier required' });
    }

    // Check if user exists
    let checkResult;
    if (user_id) {
      checkResult = await query('SELECT id, email, user_role FROM users WHERE id = $1', [user_id]);
    } else if (google_id) {
      checkResult = await query('SELECT id, email, user_role FROM users WHERE google_id = $1', [google_id]);
    } else {
      checkResult = await query('SELECT id, email, user_role FROM users WHERE email = $1', [email]);
    }

    if (checkResult.rows.length === 0) {
      // User doesn't exist, create a new one (for Google OAuth users)
      if (google_id && email) {
        await query(
          `INSERT INTO users (
            email, google_id, user_role, full_name, phone, experience,
            preferred_area, birthdate, bike_type, profile_completed,
            profile_completion_date, auth_provider
          ) VALUES ($1, $2, 'senior', $3, $4, $5, $6, $7, $8, true, NOW(), 'google')`,
          [email, google_id, full_name, phone, experience, preferred_area,
           birthdate || null, bike_type || null]
        );
        
        return res.status(201).json({ 
          message: 'Profile created and upgraded to senior member',
          user_role: 'senior'
        });
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // User exists, update their profile and upgrade to senior
    const userId = checkResult.rows[0].id;
    await query(
      `UPDATE users 
       SET user_role = 'senior', full_name = $1, phone = $2, experience = $3,
           preferred_area = $4, birthdate = $5, bike_type = $6,
           profile_completed = true, profile_completion_date = NOW()
       WHERE id = $7`,
      [full_name, phone, experience, preferred_area,
       birthdate || null, bike_type || null, userId]
    );

    return res.status(200).json({ 
      message: 'Profile updated and upgraded to senior member',
      user_role: 'senior'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: error.message });
  }
}
