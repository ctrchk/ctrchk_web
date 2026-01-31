// /api/update-profile.js
import { sql } from '@vercel/postgres';

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

    // Build the WHERE clause based on available identifier
    let whereClause = '';
    let whereValue = null;
    
    if (user_id) {
      whereClause = 'id = $1';
      whereValue = user_id;
    } else if (google_id) {
      whereClause = 'google_id = $1';
      whereValue = google_id;
    } else {
      whereClause = 'email = $1';
      whereValue = email;
    }

    // Check if user exists
    const checkResult = await sql.query(
      `SELECT id, email, user_role FROM users WHERE ${whereClause}`,
      [whereValue]
    );

    if (checkResult.rows.length === 0) {
      // User doesn't exist, create a new one (for Google OAuth users)
      if (google_id && email) {
        await sql`
          INSERT INTO users (
            email,
            google_id,
            user_role,
            full_name,
            phone,
            experience,
            preferred_area,
            birthdate,
            bike_type,
            profile_completed,
            profile_completion_date,
            auth_provider
          )
          VALUES (
            ${email},
            ${google_id},
            'senior',
            ${full_name},
            ${phone},
            ${experience},
            ${preferred_area},
            ${birthdate || null},
            ${bike_type || null},
            true,
            NOW(),
            'google'
          )
        `;
        
        return res.status(201).json({ 
          message: 'Profile created and upgraded to senior member',
          user_role: 'senior'
        });
      } else {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // User exists, update their profile and upgrade to senior
    await sql.query(
      `UPDATE users 
       SET user_role = 'senior',
           full_name = $2,
           phone = $3,
           experience = $4,
           preferred_area = $5,
           birthdate = $6,
           bike_type = $7,
           profile_completed = true,
           profile_completion_date = NOW()
       WHERE ${whereClause}`,
      [
        whereValue,
        full_name,
        phone,
        experience,
        preferred_area,
        birthdate || null,
        bike_type || null
      ]
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
