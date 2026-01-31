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

    // Check if user exists
    let checkResult;
    if (user_id) {
      checkResult = await sql`SELECT id, email, user_role FROM users WHERE id = ${user_id}`;
    } else if (google_id) {
      checkResult = await sql`SELECT id, email, user_role FROM users WHERE google_id = ${google_id}`;
    } else {
      checkResult = await sql`SELECT id, email, user_role FROM users WHERE email = ${email}`;
    }

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
    const userId = checkResult.rows[0].id;
    await sql`
      UPDATE users 
      SET user_role = 'senior',
          full_name = ${full_name},
          phone = ${phone},
          experience = ${experience},
          preferred_area = ${preferred_area},
          birthdate = ${birthdate || null},
          bike_type = ${bike_type || null},
          profile_completed = true,
          profile_completion_date = NOW()
      WHERE id = ${userId}
    `;

    return res.status(200).json({ 
      message: 'Profile updated and upgraded to senior member',
      user_role: 'senior'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: error.message });
  }
}
