import jwt from 'jsonwebtoken';

function verifyAdmin(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing token', status: 401 };
  }
  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { error: 'Server configuration error', status: 500 };
  }
  try {
    const decoded = jwt.verify(token, secret);
    if (!['admin', 'senior_admin'].includes(decoded.role)) {
      return { error: 'Forbidden: Admin access required', status: 403 };
    }
    return { decoded };
  } catch {
    return { error: 'Unauthorized: Invalid token', status: 401 };
  }
}

/**
 * Resolve bot relay endpoint.
 * Prefer explicit DISCORD_BOT_ADMIN_RELAY_ENDPOINT; otherwise derive from
 * DISCORD_BOT_SYNC_ENDPOINT by replacing pathname with /api/admin-relay.
 */
function buildBotRelayEndpoint() {
  if (process.env.DISCORD_BOT_ADMIN_RELAY_ENDPOINT) {
    return process.env.DISCORD_BOT_ADMIN_RELAY_ENDPOINT;
  }
  const syncEndpoint = process.env.DISCORD_BOT_SYNC_ENDPOINT;
  if (!syncEndpoint) return null;
  try {
    const url = new URL(syncEndpoint);
    url.pathname = '/api/admin-relay';
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const auth = verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ message: auth.error });

  const endpoint = buildBotRelayEndpoint();
  const relayToken = process.env.DISCORD_ADMIN_RELAY_TOKEN;
  if (!endpoint || !relayToken) {
    return res.status(503).json({
      message: 'Discord relay is not configured. Required: DISCORD_ADMIN_RELAY_TOKEN and either DISCORD_BOT_ADMIN_RELAY_ENDPOINT or DISCORD_BOT_SYNC_ENDPOINT',
    });
  }

  const { channelId, content, embed } = req.body || {};
  if (!channelId) return res.status(400).json({ message: 'channelId is required' });
  if (!content && !embed) return res.status(400).json({ message: 'content or embed is required' });

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${relayToken}`,
      },
      body: JSON.stringify({ channelId, content, embed }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({ message: data.message || 'Relay failed' });
    }
    return res.status(200).json({ ok: true, ...data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
