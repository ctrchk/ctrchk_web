// api/email.js
import { query } from '../lib/db.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // CORS Support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action || req.body?.action;

  try {
    // 1. action=create-account (POST)
    if (action === 'create-account') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const { email_address, password, admin_secret } = req.body;

      // Security: Check admin_secret
      if (!process.env.ADMIN_SECRET || admin_secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Validation: Email address and domain
      if (!email_address || !password) {
        return res.status(400).json({ message: 'Missing email or password' });
      }
      if (!email_address.toLowerCase().endsWith('@ctrchk.com')) {
        return res.status(400).json({ message: 'Email must end with @ctrchk.com' });
      }

      // Logic: Hash password using PBKDF2
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const password_hash = `${salt}:${hash}`;

      const result = await query(
        `INSERT INTO email_accounts (email_address, password_hash) VALUES ($1, $2) RETURNING id, email_address`,
        [email_address.toLowerCase(), password_hash]
      );
      return res.status(201).json({ message: 'Account created', account: result.rows[0] });
    }

    // 2. action=login (POST)
    if (action === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const { email_address, password } = req.body;

      const { rows } = await query('SELECT * FROM email_accounts WHERE email_address = $1', [email_address?.toLowerCase()]);
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

      const storedHash = rows[0].password_hash;
      const [salt, originalHash] = storedHash.split(':');
      if (!salt || !originalHash) return res.status(500).json({ message: 'Invalid password storage format' });

      const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      if (verifyHash !== originalHash) return res.status(401).json({ message: 'Invalid credentials' });

      // Auth: Return JWT (7 days)
      const token = jwt.sign(
        { accountId: rows[0].id, email: rows[0].email_address },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        token,
        email: rows[0].email_address,
        account: { id: rows[0].id, email_address: rows[0].email_address }
      });
    }

    // 3. action=get-emails (GET/POST)
    if (action === 'get-emails') {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

      try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        const { rows } = await query(
          'SELECT id, direction, sender, recipient, subject, body_text, body_html, created_at FROM email_messages WHERE account_id = $1 ORDER BY created_at DESC',
          [decoded.accountId]
        );
        return res.status(200).json(rows);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    // 4. action=send (POST)
    if (action === 'send') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

      try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        const { to, subject, body } = req.body;

        if (!to || !subject || !body) {
          return res.status(400).json({ message: 'Missing fields (to, subject, or body)' });
        }

        // Call Resend API
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: decoded.email,
            to: [to],
            subject: subject,
            text: body,
            html: body.replace(/\n/g, '<br>') // Simple text to html conversion if needed
          })
        });

        const resendData = await resendResp.json();
        if (!resendResp.ok) {
          return res.status(resendResp.status).json({ message: 'Resend API error', error: resendData });
        }

        // Database: Log SENT email
        await query(
          `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text) VALUES ($1, 'SENT', $2, $3, $4, $5)`,
          [decoded.accountId, decoded.email, to, subject, body]
        );

        return res.status(200).json({ message: 'Email sent successfully', id: resendData.id });
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    // 5. action=webhook-incoming (POST)
    if (action === 'webhook-incoming') {
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
      const { sender, recipient, subject, body_text, body_html, secret } = req.body;

      // Security: Check WEBHOOK_SECRET
      if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Logic: Match recipient to account_id
      const { rows } = await query('SELECT id FROM email_accounts WHERE email_address = $1', [recipient?.toLowerCase()]);
      if (rows.length === 0) {
        return res.status(200).json({ message: 'Recipient account not found, skipping' });
      }

      // Insert incoming email
      await query(
        `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'INBOX', $2, $3, $4, $5, $6)`,
        [rows[0].id, sender, recipient, subject || '(No Subject)', body_text, body_html]
      );

      return res.status(200).json({ message: 'Incoming email processed' });
    }

    return res.status(400).json({ message: 'Unknown action' });

  } catch (error) {
    console.error('Email API Error:', error);
    return res.status(500).json({ message: error.message });
  }
}
