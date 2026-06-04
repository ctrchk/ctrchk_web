// api/email/auth/login.js
import { query } from '../../../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email_address, password } = req.body;

    if (!email_address || !password) {
      return res.status(400).json({ message: 'Email address and password are required' });
    }

    const result = await query(
      'SELECT * FROM email_accounts WHERE email_address = $1',
      [email_address]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email address or password' });
    }

    const account = result.rows[0];
    const isPasswordMatch = bcrypt.compareSync(password, account.password_hash);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email address or password' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET environment variable is missing');
      return res.status(500).json({ message: 'Configuration error' });
    }

    const token = jwt.sign(
      {
        accountId: account.id,
        email: account.email_address,
        role: account.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      account: {
        id: account.id,
        email_address: account.email_address,
        role: account.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
