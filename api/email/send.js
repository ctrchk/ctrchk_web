// api/email/send.js
import { query } from '../../lib/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET;

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { recipient, subject, body_text, body_html } = req.body;
    const sender = decoded.email;
    const account_id = decoded.accountId;

    if (!recipient || !subject || (!body_text && !body_html)) {
      return res.status(400).json({ message: 'Recipient, subject, and body are required' });
    }

    // Call Resend API
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing');
      return res.status(500).json({ message: 'Email service configuration error' });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: `"${sender.split('@')[0]}" <${sender}>`,
        to: [recipient],
        subject: subject,
        text: body_text,
        html: body_html
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return res.status(resendResponse.status).json({
        message: 'Failed to send email via provider',
        error: resendData
      });
    }

    // Save to database
    await query(
      `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html)
       VALUES ($1, 'SENT', $2, $3, $4, $5, $6)`,
      [account_id, sender, recipient, subject, body_text, body_html]
    );

    return res.status(200).json({
      message: 'Email sent successfully',
      id: resendData.id
    });

  } catch (error) {
    console.error('Send email error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
