// api/email/webhook-incoming.js
import { query } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const {
      sender,
      recipient,
      subject,
      body_text,
      body_html,
      secret
    } = req.body;

    // Security check for the webhook
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!sender || !recipient) {
      return res.status(400).json({ message: 'Sender and recipient are required' });
    }

    // Find matching account_id
    const accountResult = await query(
      'SELECT id FROM email_accounts WHERE email_address = $1',
      [recipient]
    );

    if (accountResult.rows.length === 0) {
      // If no matching account, we might be receiving for an unknown address
      // For now, just ignore or log.
      console.warn(`Received email for unknown recipient: ${recipient}`);
      return res.status(200).json({ message: 'Recipient not found, ignoring' });
    }

    const account_id = accountResult.rows[0].id;

    // Save message to database
    await query(
      `INSERT INTO email_messages (account_id, direction, sender, recipient, subject, body_text, body_html)
       VALUES ($1, 'INBOX', $2, $3, $4, $5, $6)`,
      [account_id, sender, recipient, subject || '(No Subject)', body_text, body_html]
    );

    return res.status(200).json({ message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
