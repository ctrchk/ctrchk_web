// /lib/discord-role-sync.js
// 直接使用 Discord REST API 將 CTRC 等級同步至 Discord 身份組
// 不經過 Discord Bot，由 Vercel 網站端直接呼叫 Discord API
//
// 所需 Vercel 環境變數：
//   DISCORD_BOT_TOKEN          — Discord Bot Token（用於管理成員身份組）
//   DISCORD_GUILD_ID           — Discord 伺服器 ID
//   ROLE_CYCLIST_BEGINNER_ID   — 入門車手身份組 ID
//   ROLE_CYCLIST_NOVICE_ID     — 初階車手身份組 ID
//   ROLE_CYCLIST_ADVANCED_ID   — 進階車手身份組 ID
//   ROLE_CYCLIST_VETERAN_ID    — 資深車手身份組 ID
//   ROLE_CYCLIST_ELITE_ID      — 精英車手身份組 ID
//   ROLE_CYCLIST_TOP_ID        — 頂尖車手身份組 ID
//   ROLE_MILEAGE_BRONZE_ID     — 銅卡身份組 ID
//   ROLE_MILEAGE_SILVER_ID     — 銀卡身份組 ID
//   ROLE_MILEAGE_GOLD_ID       — 金卡身份組 ID
//   ROLE_MEMBERSHIP_JUNIOR_ID  — 普通會員身份組 ID
//   ROLE_MEMBERSHIP_SENIOR_ID  — 高級會員身份組 ID
//   ROLE_MEMBERSHIP_VIP_ID     — VIP 會員身份組 ID
//   ROLE_MEMBERSHIP_ADMIN_ID   — 管理員身份組 ID
//   ROLE_MEMBERSHIP_SENIOR_ADMIN_ID — 高級管理員身份組 ID

import { query } from './db.js';

const DISCORD_API = 'https://discord.com/api/v10';

const CYCLIST_RANK    = { beginner: 1, novice: 2, advanced: 3, veteran: 4, elite: 5, top: 6 };
const MILEAGE_RANK    = { bronze: 1, silver: 2, gold: 3 };
const MEMBERSHIP_RANK = { junior: 1, senior: 2, vip: 3, admin: 4, senior_admin: 5 };

function getRoleConfig() {
  return {
    cyclist: {
      beginner: process.env.ROLE_CYCLIST_BEGINNER_ID,
      novice:   process.env.ROLE_CYCLIST_NOVICE_ID,
      advanced: process.env.ROLE_CYCLIST_ADVANCED_ID,
      veteran:  process.env.ROLE_CYCLIST_VETERAN_ID,
      elite:    process.env.ROLE_CYCLIST_ELITE_ID,
      top:      process.env.ROLE_CYCLIST_TOP_ID,
    },
    mileage: {
      bronze: process.env.ROLE_MILEAGE_BRONZE_ID,
      silver: process.env.ROLE_MILEAGE_SILVER_ID,
      gold:   process.env.ROLE_MILEAGE_GOLD_ID,
    },
    membership: {
      junior:       process.env.ROLE_MEMBERSHIP_JUNIOR_ID,
      senior:       process.env.ROLE_MEMBERSHIP_SENIOR_ID,
      vip:          process.env.ROLE_MEMBERSHIP_VIP_ID,
      admin:        process.env.ROLE_MEMBERSHIP_ADMIN_ID,
      senior_admin: process.env.ROLE_MEMBERSHIP_SENIOR_ADMIN_ID,
    },
  };
}

function cyclistTierKey(level) {
  const lv = Number(level || 1);
  if (lv >= 76) return 'top';
  if (lv >= 51) return 'elite';
  if (lv >= 31) return 'veteran';
  if (lv >= 16) return 'advanced';
  if (lv >= 6)  return 'novice';
  return 'beginner';
}

function mileageCardKey(totalDistanceKm, rankOverride) {
  if (rankOverride) return String(rankOverride).toLowerCase();
  const km = Number(totalDistanceKm || 0);
  if (km >= 2000) return 'gold';
  if (km >= 500)  return 'silver';
  return 'bronze';
}

function rankValue(rankMap, key) {
  return rankMap[key] || 0;
}

function pickHigherKey(current, incoming, rankMap) {
  if (!incoming) return current;
  return rankValue(rankMap, incoming) > rankValue(rankMap, current) ? incoming : current;
}

async function fetchGuildMember(discordId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId  = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return null;
  try {
    const resp = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (resp.status === 404 || resp.status === 403) return null;
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function putMemberRole(discordId, roleId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId  = process.env.DISCORD_GUILD_ID;
  await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}/roles/${roleId}`, {
    method:  'PUT',
    headers: { Authorization: `Bot ${botToken}` },
  });
}

async function deleteMemberRole(discordId, roleId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId  = process.env.DISCORD_GUILD_ID;
  await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}/roles/${roleId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bot ${botToken}` },
  });
}

/**
 * 將 CTRC 等級（車手等級、里程卡、會員身份）同步至 Discord 身份組。
 * 以高的為準：比較 CTRC 計算的等級與 Discord 現有身份組，取較高者。
 *
 * @param {string} discordId - Discord 用戶 ID
 * @param {{ level: number|string, total_distance_km: number|string, user_role: string }} profile
 * @returns {Promise<{ synced: boolean, cyclist?: string, mileage?: string, membership?: string, reason?: string }>}
 */
export async function syncCtrchkRolesToDiscord(discordId, profile) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId  = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId || !discordId) {
    return { synced: false, reason: 'missing_config' };
  }

  try {
    const member = await fetchGuildMember(discordId);
    if (!member) return { synced: false, reason: 'member_not_in_guild' };

    const currentRoles = new Set(member.roles || []);
    const cfg = getRoleConfig();

    // CTRC 計算的目標等級 key
    const ctrcCyclist    = cyclistTierKey(profile.level);
    const ctrcMileage    = mileageCardKey(profile.mileage_km_365 || profile.total_distance_km, profile.mileage_rank);
    const ctrcMembership = profile.user_role || 'junior';

    // 找出 Discord 現有身份組中各分類的最高等級
    let discordCyclist    = null;
    let discordMileage    = null;
    let discordMembership = null;

    for (const [key, id] of Object.entries(cfg.cyclist)) {
      if (id && currentRoles.has(id) && rankValue(CYCLIST_RANK, key) > rankValue(CYCLIST_RANK, discordCyclist)) {
        discordCyclist = key;
      }
    }
    for (const [key, id] of Object.entries(cfg.mileage)) {
      if (id && currentRoles.has(id) && rankValue(MILEAGE_RANK, key) > rankValue(MILEAGE_RANK, discordMileage)) {
        discordMileage = key;
      }
    }
    for (const [key, id] of Object.entries(cfg.membership)) {
      if (id && currentRoles.has(id) && rankValue(MEMBERSHIP_RANK, key) > rankValue(MEMBERSHIP_RANK, discordMembership)) {
        discordMembership = key;
      }
    }

    // 以高的為準：取各分類中較高的等級
    const targetCyclist    = pickHigherKey(ctrcCyclist,    discordCyclist,    CYCLIST_RANK);
    const targetMileage    = pickHigherKey(ctrcMileage,    discordMileage,    MILEAGE_RANK);
    const targetMembership = pickHigherKey(ctrcMembership, discordMembership, MEMBERSHIP_RANK);

    // 建立受管理的身份組 ID 集合（所有 CTRC 控制的身份組）及目標集合
    const managed = new Set();
    const target  = new Set();

    for (const [key, id] of Object.entries(cfg.cyclist)) {
      if (id) {
        managed.add(id);
        if (key === targetCyclist) target.add(id);
      }
    }
    for (const [key, id] of Object.entries(cfg.mileage)) {
      if (id) {
        managed.add(id);
        if (key === targetMileage) target.add(id);
      }
    }
    for (const [key, id] of Object.entries(cfg.membership)) {
      if (id) {
        managed.add(id);
        if (key === targetMembership) target.add(id);
      }
    }

    // 新增缺少的身份組
    for (const id of target) {
      if (!currentRoles.has(id)) await putMemberRole(discordId, id);
    }
    // 移除不再適用的受管理身份組
    for (const id of managed) {
      if (currentRoles.has(id) && !target.has(id)) await deleteMemberRole(discordId, id);
    }

    return { synced: true, cyclist: targetCyclist, mileage: targetMileage, membership: targetMembership };
  } catch (e) {
    console.warn('[discord-role-sync] Error syncing roles:', e.message);
    return { synced: false, reason: e.message };
  }
}

/**
 * 從資料庫讀取用戶 CTRC 資料並同步 Discord 身份組。
 * 若用戶未連結 Discord 或環境變數未設置，靜默跳過。
 *
 * @param {number} userId - CTRC 用戶 ID
 */
export async function syncDiscordRolesForUser(userId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId  = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return;

  try {
    const { rows } = await query(
      `SELECT u.discord_id, u.user_role,
              COALESCE(gp.level, 1) AS level,
              COALESCE(gp.mileage_km_365, 0) AS mileage_km_365,
              COALESCE(gp.mileage_rank, 'bronze') AS mileage_rank,
              COALESCE(
                (SELECT SUM(ch.distance_km) FROM cycling_history ch WHERE ch.user_id = u.id),
                0
              ) AS total_distance_km
       FROM users u
       LEFT JOIN user_game_profile gp ON gp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    const user = rows[0];
    if (!user?.discord_id) return;
    await syncCtrchkRolesToDiscord(user.discord_id, user);
  } catch (e) {
    console.warn('[discord-role-sync] syncDiscordRolesForUser failed:', e.message);
  }
}
