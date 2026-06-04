// api/email.js
import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const action = req.query.action || req.body.action;

  if (req.method === 'POST') {
    // 1. Create Account (Admin)
    if (action === 'create-account') {
      try {
        const { email_address, password, role, admin_secret } = req.body;
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
        if (error.code === '23505') return res.status(409).json({ message: 'Email account already exists' });
        return res.status(500).json({ message: error.message });
      }
    }

    // 2. Login
    if (action === 'login') {
      try {
        const { email_address, password } = req.body;
        if (!email_address || !password) return res.status(400).json({ message: 'Email and password required' });
        const result = await query('SELECT * FROM email_accounts WHERE email_address = $1', [email_address]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        const account = result.rows[0];
        const match = await bcrypt.compare(password, account.password_hash);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ accountId: account.id, email: account.email_address, role: account.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({ token, account: { id: account.id, email_address: account.email_address, role: account.role } });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    // 3. Send Email
    if (action === 'send') {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { recipient, subject, body_text, body_html } = req.body;
        const sender = decoded.email;
        if (!recipient || !subject) return res.status(400).json({ message: 'Recipient and subject required' });

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: `"${sender.split('@')[0]}" <${sender}>`, to: [recipient], subject, text: body_text, html: body_html })
        });
        const resendData = await resendResponse.json();
        if (!resendResponse.ok) return res.status(resendResponse.status).json({ message: 'Resend error', error: resendData });

        await query(`INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'SENT', $2, $3, $4, $5, $6)`,
          [decoded.accountId, sender, recipient, subject, body_text, body_html]);
        return res.status(200).json({ message: 'Sent', id: resendData.id });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    // 4. Webhook Incoming
    if (action === 'webhook-incoming') {
      try {
        const { sender, recipient, subject, body_text, body_html, secret } = req.body;
        if (secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ message: 'Unauthorized' });
        const accountResult = await query('SELECT id FROM email_accounts WHERE email_address = $1', [recipient]);
        if (accountResult.rows.length === 0) return res.status(200).json({ message: 'Recipient not found' });
        await query(`INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'INBOX', $2, $3, $4, $5, $6)`,
          [accountResult.rows[0].id, sender, recipient, subject || '(No Subject)', body_text, body_html]);
        return res.status(200).json({ message: 'Processed' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }
  }

  // GET Actions (Optional)
  if (req.method === 'GET') {
    if (action === 'list-messages') {
        // Logic for listing messages could go here
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
