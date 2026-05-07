import { query } from './_db.js';

function getCyclistTierByLevel(level) {
  const lv = Number(level || 1);
  if (lv >= 76) return '頂尖車手';
  if (lv >= 51) return '精英車手';
  if (lv >= 31) return '資深車手';
  if (lv >= 16) return '進階車手';
  if (lv >= 6) return '初階車手';
  return '入門車手';
}

function getMileageCardByDistance(totalDistanceKm) {
  const km = Number(totalDistanceKm || 0);
  if (km >= 1000) return '金卡';
  if (km >= 300) return '銀卡';
  return '銅卡';
}

function getMembershipLabel(role) {
  const map = {
    junior: '普通會員',
    senior: '高級會員',
    vip: 'VIP 會員',
    admin: '管理員',
    senior_admin: '高級管理員',
  };
  return map[role] || role || '普通會員';
}

function requireBotToken(req, res) {
  const expected = process.env.CTRCHK_API_BOT_TOKEN;
  if (!expected) {
    res.status(503).json({ message: 'CTRCHK_API_BOT_TOKEN is not configured' });
    return false;
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-bot-token'] || '');
  if (token !== expected) {
    res.status(401).json({ message: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Bot-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  if (!requireBotToken(req, res)) return;

  const { user_id, discord_id } = req.query;
  if (!user_id && !discord_id) {
    return res.status(400).json({ message: 'user_id or discord_id is required' });
  }

  try {
    const { rows } = await query(
      `SELECT
         u.id,
         u.email,
         u.username,
         u.full_name,
         u.user_role,
         u.discord_id,
         COALESCE(gp.level, 1) AS level,
         COALESCE(gp.xp, 0) AS xp,
         COALESCE(gp.coins, 0) AS coins,
         COALESCE((SELECT SUM(ch.distance_km) FROM cycling_history ch WHERE ch.user_id = u.id), 0) AS total_distance_km
       FROM users u
       LEFT JOIN user_game_profile gp ON gp.user_id = u.id
       WHERE ($1::int IS NOT NULL AND u.id = $1) OR ($2::text IS NOT NULL AND u.discord_id = $2)
       LIMIT 1`,
      [user_id ? Number(user_id) : null, discord_id || null]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const user = rows[0];
    const totalDistanceKm = Number(user.total_distance_km || 0);
    return res.status(200).json({
      ...user,
      total_distance_km: totalDistanceKm,
      cyclist_tier: getCyclistTierByLevel(user.level),
      mileage_card: getMileageCardByDistance(totalDistanceKm),
      membership_status: getMembershipLabel(user.user_role),
    });
  } catch (error) {
    console.error('discord-profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
