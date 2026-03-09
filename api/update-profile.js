// /api/update-profile.js
import { query } from './_db.js';

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

    // Validate required field
    if (!full_name) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    // 處理多選地區（可能是陣列或逗號分隔字串）
    let preferredAreaStr = '';
    if (preferred_area) {
      if (Array.isArray(preferred_area)) {
        preferredAreaStr = preferred_area.join(',');
      } else {
        preferredAreaStr = String(preferred_area).trim();
      }
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
          [email, google_id, full_name, phone || null, experience, preferredAreaStr,
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

    // User exists — determine if this is a full profile update (senior upgrade) or partial edit
    const currentRole = checkResult.rows[0].user_role;
    const userId = checkResult.rows[0].id;

    const hasFullProfile = experience && preferredAreaStr;

    if (hasFullProfile) {
      // Full profile update: upgrade to senior if not already admin
      const newRole = currentRole === 'admin' ? 'admin' : 'senior';
      const profileCompleted = newRole !== 'admin';

      await query(
        `UPDATE users 
         SET user_role = $1, full_name = $2, phone = $3, experience = $4,
             preferred_area = $5, birthdate = $6, bike_type = $7,
             profile_completed = $8,
             profile_completion_date = CASE WHEN $8 AND profile_completion_date IS NULL THEN NOW() ELSE profile_completion_date END
         WHERE id = $9`,
        [newRole, full_name, phone || null, experience, preferredAreaStr,
         birthdate || null, bike_type || null, profileCompleted, userId]
      );

      return res.status(200).json({ 
        message: newRole === 'senior' ? 'Profile updated and upgraded to senior member' : 'Profile updated',
        user_role: newRole
      });
    } else {
      // Partial update: only update the provided basic fields, keep existing role
      await query(
        `UPDATE users 
         SET full_name = $1, phone = $2,
             birthdate = $3, bike_type = $4
         WHERE id = $5`,
        [full_name, phone || null, birthdate || null, bike_type || null, userId]
      );

      return res.status(200).json({ 
        message: 'Profile updated',
        user_role: currentRole
      });
    }

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: error.message });
  }
}

