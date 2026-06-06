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

      // Migrations for length constraints and case consistency
      await query(`ALTER TABLE email_messages ALTER COLUMN sender TYPE TEXT;`);
      await query(`ALTER TABLE email_messages ALTER COLUMN recipient TYPE TEXT;`);
      await query(`ALTER TABLE email_messages ALTER COLUMN subject TYPE TEXT;`);
      await query(`UPDATE email_accounts SET email_address = LOWER(email_address);`);

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

  // Robust Body Parsing (Handle stringified JSON or Raw Stream)
  let body = req.body || {};

  if (req.method === 'POST' && (body === null || typeof body !== 'object' || Object.keys(body).length === 0)) {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      if (rawBody) {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === 'object') {
          body = parsed;
        }
      }
    } catch (e) {
      // If it's not JSON, we keep the original body (which might be the raw string if Vercel didn't parse)
      if (typeof body !== 'object') body = {};
    }
  }

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  // Robust Action Detection
  let action = req.query.action || body.action;

  // Extra Robustness: Manually parse URL if action is missing (handles cases where req.query is empty)
  if (!action && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      action = url.searchParams.get('action');
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  // Fallback: If WEBHOOK_SECRET matches, or if it's a POST with email fields, default to webhook-incoming
  if (!action && req.method === 'POST') {
    const hasEmailFields = (body.sender || body.from) && (body.recipient || body.to) && (body.body_text || body.body_html || body.text || body.html);
    const hasValidSecret = body.secret && process.env.WEBHOOK_SECRET && body.secret === process.env.WEBHOOK_SECRET;

    if (hasValidSecret || hasEmailFields) {
      action = 'webhook-incoming';
    }
  }

  try {
    // Only run expensive DDL checks if explicitly requested or on health check
    if (!action || action === 'init-db') {
      await ensureEmailTables();
    }

    // If no action provided, return a status message (Manual Trigger/Ping)
    if (!action) {
      return res.status(200).json({
        message: 'Email API is active and database tables are initialized.',
        status: 'ready'
      });
    }

    if (action === 'init-db') {
      return res.status(200).json({
        message: 'Email tables initialized or already exist.',
        status: 'success'
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

      const cleanEmail = email_address.trim().toLowerCase();
      if (!cleanEmail.endsWith('@ctrchk.com')) {
        return res.status(400).json({ message: 'Email must end with @ctrchk.com' });
      }

      // Logic: Hash password using PBKDF2
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      const password_hash = `${salt}:${hash}`;

      const result = await query(
        `INSERT INTO email_accounts (email_address, password_hash) VALUES ($1, $2) RETURNING id, email_address`,
        [cleanEmail, password_hash]
      );
      return res.status(201).json({ message: 'Account created', account: result.rows[0] });
    }

    // 2. action=login (POST)
    if (action === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const { email_address, password } = body;

      const cleanEmail = email_address?.trim().toLowerCase();
      const { rows } = await query('SELECT * FROM email_accounts WHERE email_address = $1', [cleanEmail]);
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

        const htmlContent = emailBody.replace(/\n/g, '<br>');

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
            html: htmlContent
          })
        });

        const resendData = await resendResp.json();
        if (!resendResp.ok) {
          return res.status(resendResp.status).json({ message: 'Resend API error', error: resendData });
        }

        // Database: Log SENT email
        await query(
          `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'SENT', $2, $3, $4, $5, $6)`,
          [decoded.accountId, decoded.email, to, subject, emailBody, htmlContent]
        );

        return res.status(200).json({ message: 'Email sent successfully', id: resendData.id });
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    // 5. action=webhook-incoming (POST)
    if (action === 'webhook-incoming') {
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

      // Robust field extraction with fallbacks
      const sender = body.sender || body.from;
      const recipient = body.recipient || body.to;
      const subject = body.subject;
      const body_text = body.body_text || body.text;
      const body_html = body.body_html || body.html;
      const secret = body.secret;

      // Security: Check WEBHOOK_SECRET
      if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Robustness: Extract clean email from recipient (handles "Name <email@domain.com>" format)
      const emailRegex = /([a-zA-Z0-9._%+-]+@ctrchk\.com)/i;
      const match = recipient?.match(emailRegex);
      const cleanRecipient = match ? match[1].toLowerCase().trim() : recipient?.toLowerCase().trim();

      if (!cleanRecipient) {
        return res.status(400).json({ message: 'Recipient missing or invalid' });
      }

      // Logic: Match recipient to account_id
      let { rows } = await query('SELECT id FROM email_accounts WHERE email_address = $1', [cleanRecipient]);

      // Fallback: Strip subaddressing (e.g. user+suffix@ctrchk.com -> user@ctrchk.com)
      if (rows.length === 0 && cleanRecipient.includes('+')) {
        const baseEmail = cleanRecipient.replace(/\+[^@]*@/, '@');
        const retry = await query('SELECT id FROM email_accounts WHERE email_address = $1', [baseEmail]);
        if (retry.rows.length > 0) {
          rows = retry.rows;
        }
      }

      if (rows.length === 0) {
        console.warn(`Incoming email skipped: Recipient ${cleanRecipient} not found. Original header: ${recipient}`);
        return res.status(200).json({ message: 'Recipient account not found, skipping' });
      }

      // Insert incoming email
      const insertResult = await query(
        `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html) VALUES ($1, 'INBOX', $2, $3, $4, $5, $6) RETURNING id`,
        [rows[0].id, sender || 'Unknown Sender', cleanRecipient, subject || '(No Subject)', body_text, body_html]
      );

      return res.status(200).json({
        message: 'Incoming email processed',
        id: insertResult.rows[0].id
      });
    }

    // 6. action=change-password (POST)
    if (action === 'change-password') {
      if (req.method !== 'POST') return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

      try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        const { old_password, new_password } = body;

        if (!old_password || !new_password) {
          return res.status(400).json({ message: 'Missing old or new password' });
        }

        // Check account
        const { rows } = await query('SELECT * FROM email_accounts WHERE id = $1', [decoded.accountId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Account not found' });

        // Verify old password
        const storedHash = rows[0].password_hash;
        const [salt, originalHash] = storedHash.split(':');
        if (!salt || !originalHash) return res.status(500).json({ message: 'Invalid password storage format' });

        const verifyHash = crypto.pbkdf2Sync(old_password, salt, 1000, 64, 'sha512').toString('hex');
        if (verifyHash !== originalHash) {
          return res.status(401).json({ message: '舊密碼不正確' });
        }

        // Hash new password
        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = crypto.pbkdf2Sync(new_password, newSalt, 1000, 64, 'sha512').toString('hex');
        const newPasswordHash = `${newSalt}:${newHash}`;

        // Update database
        await query('UPDATE email_accounts SET password_hash = $1 WHERE id = $2', [newPasswordHash, decoded.accountId]);

        return res.status(200).json({ message: '密碼已成功變更' });
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    return res.status(400).json({ message: `Unknown action: ${action}` });

  } catch (error) {
    console.error('Email API Error:', error);
    return res.status(500).json({ message: error.message });
  }
}
