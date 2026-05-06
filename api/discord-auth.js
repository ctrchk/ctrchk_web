// /api/discord-auth.js
// Discord OAuth2 整合
//
//   GET  ?action=url             → 產生 Discord 授權 URL（需提供 Bearer token）
//   POST ?action=callback        → 用 code 換 token，同步 Discord 身份與伺服器身份組至 CTRC 帳戶
//   POST ?action=unlink          → 解除 Discord 連結
//   GET  ?action=status          → 取得目前 Discord 連結狀態
//
// 環境變數：
//   DISCORD_CLIENT_ID      — Discord 應用程式 Client ID
//   DISCORD_CLIENT_SECRET  — Discord 應用程式 Client Secret
//   DISCORD_GUILD_ID       — 要同步身份組的 Discord 伺服器 ID
//   DISCORD_ADMIN_ROLE_ID  — 對應 CTRC 管理員（admin）的 Discord 身份組 ID（選填）
//   DISCORD_SENIOR_ROLE_ID — 對應 CTRC 高級會員（senior）的 Discord 身份組 ID（選填）
//   BASE_URL               — 網站根網址，用於建立 redirect_uri（例如 https://ctrchk.com）
//   JWT_SECRET             — 用於驗證前端傳入的 CTRC accessToken

import { query } from './_db.js';
import jwt from 'jsonwebtoken';

const DISCORD_API = 'https://discord.com/api/v10';

// Discord OAuth2 所需的授權範圍：
//   identify            — 取得 Discord 用戶 ID、用戶名、頭像
//   email               — 取得 Discord 電子郵件（備用，不強制要求）
//   guilds.members.read — 讀取用戶在指定伺服器的身份組
const SCOPES = 'identify email guilds.members.read';

// Maximum age of the OAuth2 state parameter (15 minutes)
const STATE_EXPIRY_MS = 15 * 60 * 1000;

function getRedirectUri(req) {
  const base = process.env.BASE_URL || `https://${req.headers.host}`;
  return `${base}/discord-callback`;
}

// 驗證 CTRC JWT，回傳 userId；失敗時回傳 null
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

// 交換 Discord 授權碼換取 access token
async function exchangeCode(code, redirectUri) {
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

  const adminRoleId  = process.env.DISCORD_ADMIN_ROLE_ID;
  const seniorRoleId = process.env.DISCORD_SENIOR_ROLE_ID;

  if (adminRoleId && discordRoles.includes(adminRoleId)) return 'admin';
  if (seniorRoleId && discordRoles.includes(seniorRoleId)) {
    // 不降級：若用戶已是管理員，維持管理員
    return currentRole === 'admin' ? 'admin' : 'senior';
  }
  // 沒有匹配的身份組：不降級，維持現有等級
  return currentRole;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action;

  // ── GET ?action=url ─────────────────────────────────────────────────────────
  // 產生 Discord OAuth2 授權 URL（用戶必須已登入 CTRC）
  if (req.method === 'GET' && action === 'url') {
    const userId = verifyCtrchkToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ message: '請先登入 CTRC 帳戶' });

    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) return res.status(503).json({ message: 'Discord 整合尚未設置（缺少 DISCORD_CLIENT_ID）' });

    // 將 CTRC userId 編碼進 state，供 callback 時使用
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
    const redirectUri = getRedirectUri(req);

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

      const redirectUri = getRedirectUri(req);

      // 1. 交換授權碼換取 Discord access token
      const tokenData = await exchangeCode(code, redirectUri);
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
