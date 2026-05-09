// /api/oauth.js
// 統一 OAuth 端點，處理 Google 登入及 Discord 帳號連結
//
// ── Google 登入 ──────────────────────────────────────────────────────────────
//   POST /api/oauth              → 驗證 Google ID Token，建立或登入用戶
//
// ── Discord 整合 ─────────────────────────────────────────────────────────────
//   GET  /api/oauth?action=url           → 產生 Discord 授權 URL（需提供 Bearer token）
//   POST /api/oauth?action=callback      → 用 code 換 token，同步 Discord 身份組至 CTRC 帳戶
//   POST /api/oauth?action=unlink        → 解除 Discord 連結
//   GET  /api/oauth?action=status        → 取得目前 Discord 連結狀態
//
// 環境變數：
//   GOOGLE_CLIENT_ID       — Google OAuth2 用戶端 ID（可選，不設則略過受眾驗證）
//   DISCORD_CLIENT_ID      — Discord 應用程式 Client ID
//   DISCORD_CLIENT_SECRET  — Discord 應用程式 Client Secret
//   DISCORD_GUILD_ID       — 要同步身份組的 Discord 伺服器 ID
//   DISCORD_SENIOR_ADMIN_ROLE_ID — 對應 CTRC 高級管理員（senior_admin）的 Discord 身份組 ID（選填）
//   DISCORD_VIP_ROLE_ID          — 對應 CTRC VIP 會員（vip）的 Discord 身份組 ID（選填）
//   DISCORD_ADMIN_ROLE_ID        — 對應 CTRC 管理員（admin）的 Discord 身份組 ID（選填）
//   DISCORD_SENIOR_ROLE_ID       — 對應 CTRC 高級會員（senior）的 Discord 身份組 ID（選填）
//   BASE_URL               — 網站根網址，用於建立 Discord redirect_uri（例如 https://ctrchk.com）
//   JWT_SECRET             — 用於簽發及驗證 CTRC accessToken

import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';

// ════════════════════════════════════════════════════════════════════════════
// 共用工具
// ════════════════════════════════════════════════════════════════════════════

/** 驗證 CTRC JWT，回傳 userId；失敗時回傳 null */
function verifyCtrchkToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId || null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Google 登入邏輯
// ════════════════════════════════════════════════════════════════════════════

/**
 * 呼叫 Google 的 tokeninfo 端點驗證 ID Token。
 * 回傳已驗證的 payload（含 sub, email, name, picture）。
 *
 * 注意：此方法需要一次網路請求來驗證 token。
 * 若需要在高流量環境降低延遲，可改用 google-auth-library 套件在本地驗證。
 * 參考：https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */
async function verifyGoogleCredential(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Google ID Token 驗證失敗，請重試。');
  }
  const payload = await resp.json();

  // 確認受眾（audience）是我們自己的 Client ID
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google Token 的受眾不符合，可能是偽造的 Token。');
  }

  return payload;
}

async function handleGoogleAuth(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: '缺少 Google 憑證（credential）' });
    }

    // 1. 驗證 Google ID Token
    const payload = await verifyGoogleCredential(credential);
    const google_id = payload.sub;       // Google 用戶唯一 ID
    const email     = payload.email;
    const full_name = payload.name || '';

    if (!google_id || !email) {
      return res.status(400).json({ message: 'Google Token 中缺少用戶資訊' });
    }

    // 2. 查詢資料庫是否已有此用戶
    const { rows } = await query(
      'SELECT id, email, username, user_role, full_name, profile_completed, google_id, email_verified, avatar_url FROM users WHERE google_id = $1 OR email = $2',
      [google_id, email]
    );

    let user;

    // 已知高級管理員電郵清單（與 database-schema.sql 種子資料同步）
    const SENIOR_ADMIN_EMAILS = ['ctrcz9829@gmail.com'];

    if (rows.length > 0) {
      user = rows[0];

      // 若用戶原本以 email 方式註冊，補上 google_id 並標記電郵已驗證
      // （Google 帳號代表 Google 已驗證此電郵，無需再次驗證）
      const needsGoogleId    = !rows[0].google_id;
      const needsVerification = !rows[0].email_verified;
      // 若用戶沒有頭像，使用 Google 頭像
      const needsAvatar = !rows[0].avatar_url && payload.picture;
      // 若該電郵屬於已知高級管理員但資料庫角色尚未設為 senior_admin，自動修正
      const needsSeniorAdminRole = SENIOR_ADMIN_EMAILS.includes(email.toLowerCase()) && rows[0].user_role !== 'senior_admin';

      if (needsGoogleId && needsVerification) {
        await query(
          `UPDATE users
             SET google_id = $1, email_verified = true,
                 verification_token = NULL, verification_token_expiry = NULL
           WHERE id = $2`,
          [google_id, user.id]
        );
      } else if (needsGoogleId) {
        await query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
      } else if (needsVerification) {
        await query(
          `UPDATE users
             SET email_verified = true,
                 verification_token = NULL, verification_token_expiry = NULL
           WHERE id = $1`,
          [user.id]
        );
      }

      if (needsAvatar) {
        await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [payload.picture, user.id]);
        user.avatar_url = payload.picture;
      }

      if (needsSeniorAdminRole) {
        await query('UPDATE users SET user_role = $1 WHERE id = $2', ['senior_admin', user.id]);
        user.user_role = 'senior_admin';
      }

      if (needsVerification) {
        user.email_verified = true;
      }
    } else {
      // 3. 新用戶：建立帳號，高級管理員電郵直接設為 senior_admin，其餘為 junior
      const newRole = SENIOR_ADMIN_EMAILS.includes(email.toLowerCase()) ? 'senior_admin' : 'junior';
      const emailBase = String(email || '').split('@')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
      const fallbackBase = `u${Date.now()}`.slice(0, 16);
      const baseName = emailBase || fallbackBase;
      const usernameSeed = baseName.length < 4 ? (baseName + '0000').slice(0, 4) : baseName;
      const { rows: usernameRows } = await query(
        `SELECT username FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(username) LIKE LOWER($2)`,
        [usernameSeed, `${usernameSeed}%`]
      );
      const taken = new Set(usernameRows.map((r) => String(r.username || '').toLowerCase()));
      let finalUsername = usernameSeed;
      if (taken.has(finalUsername.toLowerCase())) {
        let found = false;
        for (let i = 1; i <= 9999; i++) {
          const suffix = String(i);
          const candidate = (usernameSeed.slice(0, Math.max(0, 16 - suffix.length)) + suffix).slice(0, 16);
          if (candidate.length >= 4 && !taken.has(candidate.toLowerCase())) {
            finalUsername = candidate;
            found = true;
            break;
          }
        }
        if (!found) finalUsername = `u${Date.now()}`.slice(0, 16);
      }
      const googleAvatarUrl = payload.picture || null;
      const insertResult = await query(
        `INSERT INTO users (email, google_id, username, full_name, user_role, auth_provider, profile_completed, email_verified, avatar_url)
         VALUES ($1, $2, $3, $4, $5, 'google', false, true, $6)
         RETURNING id, email, username, user_role, full_name, profile_completed, avatar_url`,
        [email, google_id, finalUsername, full_name, newRole, googleAvatarUrl]
      );
      user = insertResult.rows[0];
    }

    // 4. 簽發 JWT（與 email 登入流程保持一致）
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('伺服器未設置 JWT_SECRET 環境變數，請聯絡管理員。');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.user_role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 獲取最新的 full_name
    const fullNameToReturn = user.full_name || full_name || '';

    return res.status(200).json({
      message: rows.length > 0 ? '登入成功' : '已建立新帳號',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || '',
        full_name: fullNameToReturn,
        user_role: user.user_role,
        role: user.user_role,
        profile_completed: user.profile_completed,
        email_verified: true, // Google 帳號視為已驗證
        auth_provider: 'google',
        avatar_url: user.avatar_url || null
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ message: error.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Discord 整合邏輯
// ════════════════════════════════════════════════════════════════════════════

const DISCORD_API = 'https://discord.com/api/v10';

// Discord OAuth2 所需的授權範圍：
//   identify            — 取得 Discord 用戶 ID、用戶名、頭像
//   email               — 取得 Discord 電子郵件（備用，不強制要求）
//   guilds.members.read — 讀取用戶在指定伺服器的身份組
const SCOPES = 'identify email guilds.members.read';

// Maximum age of the OAuth2 state parameter (15 minutes)
const STATE_EXPIRY_MS = 15 * 60 * 1000;

function getDiscordRedirectUri(req) {
  const base = process.env.BASE_URL || `https://${req.headers.host}`;
  return `${base}/discord-callback`;
}

// 交換 Discord 授權碼換取 access token
async function exchangeDiscordCode(code, redirectUri) {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
  });
  const resp = await fetch(`${DISCORD_API}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Discord token exchange failed: ${err}`);
  }
  return resp.json();
}

// 取得 Discord 用戶基本資訊
async function fetchDiscordUser(accessToken) {
  const resp = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error('Failed to fetch Discord user info');
  return resp.json();
}

// 取得用戶在指定伺服器中的身份組清單（需要 guilds.members.read 範圍）
// 回傳值：
//   null  — 用戶不在伺服器（404/403）或伺服器 ID 未設置
//   []    — 用戶在伺服器但沒有任何身份組
//   [...] — 用戶在伺服器並持有對應身份組 ID 清單
async function fetchGuildMemberRoles(accessToken, guildId) {
  if (!guildId) return null;
  const resp = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (resp.status === 404 || resp.status === 403) return null; // 不在伺服器
  if (!resp.ok) return null;
  const member = await resp.json();
  return Array.isArray(member.roles) ? member.roles : [];
}

// 根據 Discord 身份組 ID 清單，決定對應的 CTRC 用戶等級
// discordRoles 為 null 表示用戶不在伺服器（不升級）
// 優先級：admin > senior > junior（僅在角色比現有角色更高時才升級；不降級）
function mapRolesToCtrchkRole(discordRoles, currentRole) {
  if (!Array.isArray(discordRoles)) return currentRole; // 不在伺服器，維持現有等級

  const roleRank = { junior: 1, senior: 2, vip: 3, admin: 4, senior_admin: 5 };
  const keepHigher = (candidate) => {
    const current = roleRank[currentRole] || 1;
    const next = roleRank[candidate] || 1;
    return next > current ? candidate : currentRole;
  };

  const seniorAdminRoleId = process.env.DISCORD_SENIOR_ADMIN_ROLE_ID;
  const vipRoleId = process.env.DISCORD_VIP_ROLE_ID;
  const adminRoleId  = process.env.DISCORD_ADMIN_ROLE_ID;
  const seniorRoleId = process.env.DISCORD_SENIOR_ROLE_ID;

  if (seniorAdminRoleId && discordRoles.includes(seniorAdminRoleId)) return keepHigher('senior_admin');
  if (vipRoleId && discordRoles.includes(vipRoleId)) return keepHigher('vip');
  if (adminRoleId && discordRoles.includes(adminRoleId)) return keepHigher('admin');
  if (seniorRoleId && discordRoles.includes(seniorRoleId)) {
    return keepHigher('senior');
  }
  // 沒有匹配的身份組：不降級，維持現有等級
  return currentRole;
}

const DISCORD_CONNECT_REWARD_KEY = 'discord_connect_2026_05';
const DISCORD_CONNECT_REWARD_COINS = 100;
const DISCORD_CONNECT_REWARD_END_UTC = '2026-05-31T23:59:59.999Z';

async function grantDiscordConnectRewardIfEligible(userId) {
  if (Date.now() > Date.parse(DISCORD_CONNECT_REWARD_END_UTC)) {
    return { rewarded: false, coins: 0 };
  }

  const { rowCount } = await query(
    `INSERT INTO user_reward_log (user_id, reward_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id, reward_key) DO NOTHING`,
    [userId, DISCORD_CONNECT_REWARD_KEY]
  );

  if (!rowCount) {
    return { rewarded: false, coins: 0 };
  }

  await query(
    `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
     VALUES ($1, 1, 0, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET coins = user_game_profile.coins + $2, updated_at = NOW()`,
    [userId, DISCORD_CONNECT_REWARD_COINS]
  );

  return { rewarded: true, coins: DISCORD_CONNECT_REWARD_COINS };
}

async function triggerDiscordBotSync(userId, discordId) {
  const endpoint = process.env.DISCORD_BOT_SYNC_ENDPOINT;
  const token = process.env.DISCORD_BOT_SYNC_TOKEN;
  if (!endpoint || !token) return;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, discordId }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[oauth] Discord bot sync failed: ${resp.status} ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.warn('Failed to trigger Discord bot sync:', e.message);
  }
}

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

const MEMBERSHIP_RANK = { junior: 1, senior: 2, vip: 3, admin: 4, senior_admin: 5 };
const CYCLIST_TIER_RANK = { beginner: 1, novice: 2, advanced: 3, veteran: 4, elite: 5, top: 6 };
const MILEAGE_CARD_RANK = { bronze: 1, silver: 2, gold: 3 };
const DISCORD_SYNC_ROUTE_NAME = 'Discord 里程卡同步';
const DISCORD_SYNC_SOURCE = 'discord_sync';
const DISTANCE_EPSILON_KM = 0.01;

function extractBotToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function pickHigherByRank(current, incoming, rankMap) {
  const c = rankMap[current] || 0;
  const n = rankMap[incoming] || 0;
  return n > c ? incoming : current;
}

function cyclistTierKeyByLevel(level) {
  const lv = Number(level || 1);
  if (lv >= 76) return 'top';
  if (lv >= 51) return 'elite';
  if (lv >= 31) return 'veteran';
  if (lv >= 16) return 'advanced';
  if (lv >= 6) return 'novice';
  return 'beginner';
}

function cyclistTierMinLevel(key) {
  const map = { beginner: 1, novice: 6, advanced: 16, veteran: 31, elite: 51, top: 76 };
  return map[key] || 1;
}

function mileageCardKeyByDistance(totalDistanceKm) {
  const km = Number(totalDistanceKm || 0);
  if (km >= 1000) return 'gold';
  if (km >= 300) return 'silver';
  return 'bronze';
}

function mileageCardMinDistance(key) {
  const map = { bronze: 0, silver: 300, gold: 1000 };
  return map[key] || 0;
}

function parseNonNegativeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parsePositiveInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

async function fetchDiscordProfileRow(userId, discordId) {
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
    [userId ? Number(userId) : null, discordId || null]
  );
  return rows[0] || null;
}

function buildDiscordProfileResponse(user) {
  const totalDistanceKm = Number(user.total_distance_km || 0);
  return {
    ...user,
    total_distance_km: totalDistanceKm,
    cyclist_tier: getCyclistTierByLevel(user.level),
    mileage_card: getMileageCardByDistance(totalDistanceKm),
    membership_status: getMembershipLabel(user.user_role),
  };
}

async function handleDiscordAction(req, res, action) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET ?action=discord-profile ─────────────────────────────────────────────
  // Bot 專用：回傳指定 user/discord 的三軌資料
  if (req.method === 'GET' && action === 'discord-profile') {
    const expected = process.env.CTRCHK_API_BOT_TOKEN;
    if (!expected) return res.status(503).json({ message: 'CTRCHK_API_BOT_TOKEN is not configured' });
    const token = extractBotToken(req);
    if (token !== expected) return res.status(401).json({ message: 'Unauthorized' });

    const { user_id, discord_id } = req.query;
    if (!user_id && !discord_id) {
      return res.status(400).json({ message: 'user_id or discord_id is required' });
    }

    try {
      const user = await fetchDiscordProfileRow(user_id, discord_id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.status(200).json(buildDiscordProfileResponse(user));
    } catch (error) {
      console.error('discord-profile error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  // ── POST ?action=discord-merge-higher ───────────────────────────────────────
  // Bot 專用：以「較高者為準」回寫網站三軌資料
  if (req.method === 'POST' && action === 'discord-merge-higher') {
    const expected = process.env.CTRCHK_API_BOT_TOKEN;
    if (!expected) return res.status(503).json({ message: 'CTRCHK_API_BOT_TOKEN is not configured' });
    const token = extractBotToken(req);
    if (token !== expected) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body || {};
    const bodyUserId = body.user_id ?? body.userId ?? null;
    const bodyDiscordId = body.discord_id ?? body.discordId ?? null;
    if (!bodyUserId && !bodyDiscordId) {
      return res.status(400).json({ message: 'user_id or discord_id is required' });
    }

    try {
      const currentUser = await fetchDiscordProfileRow(bodyUserId, bodyDiscordId);
      if (!currentUser) return res.status(404).json({ message: 'User not found' });

      const currentRole = currentUser.user_role || 'junior';
      const currentLevel = parsePositiveInteger(currentUser.level) || 1;
      const currentDistance = parseNonNegativeNumber(currentUser.total_distance_km) || 0;

      const incomingRole = MEMBERSHIP_RANK[body.user_role] ? body.user_role : null;
      const incomingLevel = parsePositiveInteger(body.level);
      const incomingDistance = parseNonNegativeNumber(body.total_distance_km);

      const mergedRole = pickHigherByRank(currentRole, incomingRole, MEMBERSHIP_RANK);
      const mergedCyclistKey = pickHigherByRank(
        cyclistTierKeyByLevel(currentLevel),
        incomingLevel ? cyclistTierKeyByLevel(incomingLevel) : null,
        CYCLIST_TIER_RANK
      );
      const mergedMileageKey = pickHigherByRank(
        mileageCardKeyByDistance(currentDistance),
        incomingDistance !== null ? mileageCardKeyByDistance(incomingDistance) : null,
        MILEAGE_CARD_RANK
      );

      const mergedLevel = Math.max(
        currentLevel,
        incomingLevel || 0,
        cyclistTierMinLevel(mergedCyclistKey)
      );
      const mergedDistance = Math.max(
        currentDistance,
        incomingDistance !== null ? incomingDistance : 0,
        mileageCardMinDistance(mergedMileageKey)
      );

      if (mergedRole !== currentRole) {
        await query('UPDATE users SET user_role = $1 WHERE id = $2', [mergedRole, currentUser.id]);
      }

      if (mergedLevel > currentLevel) {
        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, $2, 0, 0, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET level = GREATEST(user_game_profile.level, EXCLUDED.level),
                 updated_at = NOW()`,
          [currentUser.id, mergedLevel]
        );
      }

      if (mergedDistance - currentDistance >= DISTANCE_EPSILON_KM) {
        const deltaKm = Number((mergedDistance - currentDistance).toFixed(2));
        await query(
          `INSERT INTO cycling_history (user_id, ride_date, distance_km, route_name, source, created_at)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, NOW())`,
          [currentUser.id, deltaKm, DISCORD_SYNC_ROUTE_NAME, DISCORD_SYNC_SOURCE]
        );
      }

      const updatedUser = await fetchDiscordProfileRow(currentUser.id, null);
      return res.status(200).json({
        merged: true,
        profile: buildDiscordProfileResponse(updatedUser || currentUser),
      });
    } catch (error) {
      console.error('discord-merge-higher error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  // ── GET ?action=url ─────────────────────────────────────────────────────────
  // 產生 Discord OAuth2 授權 URL（用戶必須已登入 CTRC）
  if (req.method === 'GET' && action === 'url') {
    const userId = verifyCtrchkToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: '請先登入 CTRC 帳戶' });

    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) return res.status(503).json({ message: 'Discord 整合尚未設置（缺少 DISCORD_CLIENT_ID）' });

    // 將 CTRC userId 編碼進 state，供 callback 時使用
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
    const redirectUri = getDiscordRedirectUri(req);

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id',     clientId);
    url.searchParams.set('redirect_uri',  redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope',         SCOPES);
    url.searchParams.set('state',         state);

    return res.status(200).json({ url: url.toString() });
  }

  // ── GET ?action=status ───────────────────────────────────────────────────────
  // 取得目前帳戶的 Discord 連結狀態
  if (req.method === 'GET' && action === 'status') {
    const userId = verifyCtrchkToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: '請先登入 CTRC 帳戶' });

    try {
      const { rows } = await query(
        'SELECT discord_id FROM users WHERE id = $1',
        [userId]
      );
      if (rows.length === 0) return res.status(404).json({ message: '用戶不存在' });
      return res.status(200).json({ linked: !!rows[0].discord_id, discord_id: rows[0].discord_id || null });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }

  // ── POST ?action=callback ────────────────────────────────────────────────────
  // 交換授權碼，同步 Discord 身份組至 CTRC 帳戶
  if (req.method === 'POST' && action === 'callback') {
    try {
      const { code, state } = req.body;
      if (!code || !state) return res.status(400).json({ message: '缺少 code 或 state 參數' });

      // 從 state 解碼 CTRC userId
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      } catch {
        return res.status(400).json({ message: 'state 參數無效' });
      }
      const userId = stateData.userId;
      if (!userId) return res.status(400).json({ message: 'state 中缺少用戶 ID' });

      // 確認 state 未過期
      if (Date.now() - (stateData.ts || 0) > STATE_EXPIRY_MS) {
        return res.status(400).json({ message: '授權連結已過期，請重新嘗試' });
      }

      const clientId     = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(503).json({ message: 'Discord 整合尚未設置（缺少環境變數）' });
      }

      const redirectUri = getDiscordRedirectUri(req);

      // 1. 交換授權碼換取 Discord access token
      const tokenData = await exchangeDiscordCode(code, redirectUri);
      const discordAccessToken = tokenData.access_token;

      // 2. 取得 Discord 用戶資訊
      const discordUser = await fetchDiscordUser(discordAccessToken);
      const discordId   = discordUser.id;
      if (!discordId) return res.status(400).json({ message: '無法取得 Discord 用戶 ID' });

      // 3. 檢查此 Discord 帳號是否已連結至其他 CTRC 帳戶
      const { rows: existingRows } = await query(
        'SELECT id FROM users WHERE discord_id = $1 AND id != $2',
        [discordId, userId]
      );
      if (existingRows.length > 0) {
        return res.status(409).json({ message: '此 Discord 帳號已連結至另一個 CTRC 帳戶' });
      }

      // 4. 取得 Discord 伺服器身份組
      const guildId     = process.env.DISCORD_GUILD_ID;
      const memberRoles = await fetchGuildMemberRoles(discordAccessToken, guildId);

      // 5. 取得現有 CTRC 用戶等級
      const { rows: userRows } = await query('SELECT user_role FROM users WHERE id = $1', [userId]);
      if (userRows.length === 0) return res.status(404).json({ message: '用戶不存在' });
      const currentRole = userRows[0].user_role || 'junior';

      // 6. 計算新等級（只升不降）
      const newRole = mapRolesToCtrchkRole(memberRoles, currentRole);

      // 7. 更新資料庫
      await query(
        'UPDATE users SET discord_id = $1, user_role = $2 WHERE id = $3',
        [discordId, newRole, userId]
      );

      // 8. Discord 連結限時獎勵（到 2026-05-31）
      const rewardResult = await grantDiscordConnectRewardIfEligible(userId);
      // 9. 通知 Discord Bot 同步身份組（若已配置）
      await triggerDiscordBotSync(userId, discordId);

      const inGuild = guildId ? memberRoles !== null : false;
      return res.status(200).json({
        message: 'Discord 帳號連結成功',
        discord_username: discordUser.username,
        discord_global_name: discordUser.global_name || discordUser.username,
        discord_avatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
          : null,
        role_synced: newRole,
        in_guild: inGuild,
        roles_matched: memberRoles,
        reward_granted: rewardResult.rewarded,
        reward_coins: rewardResult.coins,
      });
    } catch (e) {
      console.error('Discord callback error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  // ── POST ?action=unlink ──────────────────────────────────────────────────────
  // 解除 Discord 連結（不影響用戶等級）
  if (req.method === 'POST' && action === 'unlink') {
    const userId = verifyCtrchkToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: '請先登入 CTRC 帳戶' });

    try {
      await query('UPDATE users SET discord_id = NULL WHERE id = $1', [userId]);
      return res.status(200).json({ message: 'Discord 帳號已解除連結' });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }

  return res.status(400).json({ message: '未知的 action 參數' });
}

// ════════════════════════════════════════════════════════════════════════════
// 主處理器
// ════════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const action = req.query.action;

  // 有 action 參數 → Discord 整合
  if (action) {
    return handleDiscordAction(req, res, action);
  }

  // 無 action 參數 → Google 登入（只接受 POST）
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  return handleGoogleAuth(req, res);
}
