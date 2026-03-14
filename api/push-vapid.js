// /api/push-vapid.js
// Returns the VAPID public key for client-side Web Push subscription setup.
// The public key is safe to expose; the private key stays server-side.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  res.status(200).json({ publicKey });
}
