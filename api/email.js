// api/email.js
import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const action = req.query.action || req.body?.action;

  try {
    // 1. Create Account (Admin Secret Protected)
    if (action === 'create-account') {
      const { email_address, password, role, admin_secret } = req.body;
      if (!process.env.ADMIN_SECRET || admin_secret !== process.env.ADMIN_SECRET) return res.status(401).json({ message: 'Unauthorized' });
      if (!email_address || !password) return res.status(400).json({ message: 'Missing fields' });
      const hash = await bcrypt.hash(password, 10);
      const result = await query(`INSERT INTO email_accounts (email_address, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email_address, role`, [email_address, hash, role === 'ADMIN' ? 'ADMIN' : 'USER']);
      return res.status(201).json({ message: 'Account created', account: result.rows[0] });
    }

    // 2. Login
    if (action === 'login') {
      const { email_address, password } = req.body;
      const { rows } = await query('SELECT * FROM email_accounts WHERE email_address = $1', [email_address]);
      if (rows.length === 0 || !await bcrypt.compare(password, rows[0].password_hash)) return res.status(401).json({ message: 'Invalid credentials' });
      const token = jwt.sign({ accountId: rows[0].id, email: rows[0].email_address, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.status(200).json({ token, account: { id: rows[0].id, email_address: rows[0].email_address, role: rows[0].role } });
    }

    // 3. Send Email (JWT Protected)
    if (action === 'send') {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
      const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      const { recipient, subject, body_text, body_html } = req.body;
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: `"${decoded.email.split('@')[0]}" <${decoded.email}>`, to: [recipient], subject, text: body_text, html: body_html })
      });
      const resendData = await resendResp.json();
      if (!resendResp.ok) return res.status(resendResp.status).json({ message: 'Resend error', error: resendData });
      await query(`INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'SENT', $2, $3, $4, $5, $6)`, [decoded.accountId, decoded.email, recipient, subject, body_text, body_html]);
      return res.status(200).json({ message: 'Sent', id: resendData.id });
    }

    // 4. Webhook Incoming (Cloudflare Secret Protected)
    if (action === 'webhook-incoming') {
      const { sender, recipient, subject, body_text, body_html, secret } = req.body;
      if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ message: 'Unauthorized' });
      const { rows } = await query('SELECT id FROM email_accounts WHERE email_address = $1', [recipient]);
      if (rows.length === 0) return res.status(200).json({ message: 'Recipient not found' });
      await query(`INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'INBOX', $2, $3, $4, $5, $6)`, [rows[0].id, sender, recipient, subject || '(No Subject)', body_text, body_html]);
      return res.status(200).json({ message: 'Processed' });
    }

    return res.status(400).json({ message: 'Unknown action' });
  } catch (error) { return res.status(500).json({ message: error.message }); }
}
