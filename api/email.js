// api/email.js
import { query } from '../lib/db.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

let _ensureEmailTablesPromise = null;
async function ensureEmailTables() {
  if (!_ensureEmailTablesPromise) {
    _ensureEmailTablesPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS email_accounts (
            id SERIAL PRIMARY KEY,
            email_address VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
            created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS email_messages (
            id SERIAL PRIMARY KEY,
            account_id INTEGER REFERENCES email_accounts(id) ON DELETE CASCADE,
            direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOX', 'SENT')),
            sender VARCHAR(255) NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            body_text TEXT,
            body_html TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_email_accounts_email_address ON email_accounts(email_address);`);
    })().catch((err) => {
      _ensureEmailTablesPromise = null;
      throw err;
    });
  }
  await _ensureEmailTablesPromise;
}

export default async function handler(req, res) {
  // CORS Support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Robust Body Parsing (Handle stringified JSON if Vercel doesn't parse it)
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.warn('Failed to parse body as JSON:', e.message);
    }
  }

  // Robust Action Detection
  let action = req.query.action || body.action;

  // Fallback: If WEBHOOK_SECRET matches, default to webhook-incoming
  if (!action && body.secret && process.env.WEBHOOK_SECRET && body.secret === process.env.WEBHOOK_SECRET) {
    action = 'webhook-incoming';
  }

  try {
    await ensureEmailTables();

    // If no action provided, return a status message (Manual Trigger/Ping)
    if (!action) {
      return res.status(200).json({
        message: 'Email API is active and database tables are initialized.',
        status: 'ready'
      });
    }

    // 1. action=create-account (POST)
    if (action === 'create-account') {
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const { email_address, password, admin_secret } = body;

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
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const { email_address, password } = body;

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
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

      try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        const { to, subject, body: emailBody } = body;

        if (!to || !subject || !emailBody) {
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
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
          })
        });

        const resendData = await resendResp.json();
        if (!resendResp.ok) {
          return res.status(resendResp.status).json({ message: 'Resend API error', error: resendData });
        }

        // Database: Log SENT email
        await query(
          `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text) VALUES ($1, 'SENT', $2, $3, $4, $5)`,
          [decoded.accountId, decoded.email, to, subject, emailBody]
        );

        return res.status(200).json({ message: 'Email sent successfully', id: resendData.id });
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    // 5. action=webhook-incoming (POST)
    if (action === 'webhook-incoming') {
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const { sender, recipient, subject, body_text, body_html, secret } = body;

      // Security: Check WEBHOOK_SECRET
      if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Robustness: Extract clean email from recipient (handles "Name <email@domain.com>" format)
      const emailRegex = /(?:<|^)([^>\s]+@ctrchk\.com)(?:>|$)/i;
      const match = recipient?.match(emailRegex);
      const cleanRecipient = match ? match[1].toLowerCase() : recipient?.toLowerCase();

      // Logic: Match recipient to account_id
      const { rows } = await query('SELECT id FROM email_accounts WHERE email_address = $1', [cleanRecipient]);
      if (rows.length === 0) {
        console.warn(`Incoming email skipped: Recipient ${cleanRecipient} not found in email_accounts.`);
        return res.status(200).json({ message: 'Recipient account not found, skipping' });
      }

      // Insert incoming email
      await query(
        `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'INBOX', $2, $3, $4, $5, $6)`,
        [rows[0].id, sender, cleanRecipient, subject || '(No Subject)', body_text, body_html]
      );

      return res.status(200).json({ message: 'Incoming email processed' });
    }

    return res.status(400).json({ message: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Email API Error:', error);
    return res.status(500).json({ message: error.message });
  }
}
