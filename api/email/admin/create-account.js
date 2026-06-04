// api/email/admin/create-account.js
import { query } from '../../../lib/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email_address, password, role, admin_secret } = req.body;

    // Admin authorization check
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET || admin_secret !== ADMIN_SECRET) {
      return res.status(401).json({ message: 'Unauthorized admin access' });
    }

    if (!email_address || !password) {
      return res.status(400).json({ message: 'Email address and password are required' });
    }

    if (!email_address.endsWith('@ctrchk.com')) {
      return res.status(400).json({ message: 'Only @ctrchk.com addresses are allowed' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    const result = await query(
      `INSERT INTO email_accounts (email_address, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email_address, role`,
      [email_address, password_hash, userRole]
    );

    return res.status(201).json({
      message: 'Email account created successfully',
      account: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating email account:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Email account already exists' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
