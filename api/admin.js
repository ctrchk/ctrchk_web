// /api/admin.js
// Consolidated Admin API - Handles User Management, Route Config, and Discord Relay
import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { syncDiscordRolesForUser } from '../lib/discord-role-sync.js';
import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize AI tools
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Helpers from admin-users.js ---
function calcLevel(xp) {
  const thresholds = [
    0, 80, 200, 380, 620, 950, 1400, 1980, 2700, 3600,
    4000, 5100, 6500, 8100, 10000, 12200, 14800, 17800, 21200, 25200,
    28200, 33000, 38300, 44200, 50600, 57800, 65500, 74100, 83500, 93900,
    98800, 110600, 123500, 137800, 153500, 170700, 189700, 210500, 233500, 258700,
    267300, 295800, 327100, 361500, 399400, 441100, 487000, 537500, 593000, 654000,
  ];
  const BASE_GAP = 61000, GROWTH = 1.10, BASE_XP = 654000, BASE_LVL = 50;
  if (xp < BASE_XP) {
    let lo = 0, hi = thresholds.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (thresholds[mid] <= xp) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  }
  const n = BASE_LVL + Math.log(1 + (xp - BASE_XP) * (GROWTH - 1) / BASE_GAP) / Math.log(GROWTH);
  return Math.floor(n) + 1;
}

function buildStationId(area, stationNumber) {
  return `${String(area || '').trim().toUpperCase()}${String(parseInt(stationNumber, 10)).padStart(2, '0')}`;
}

function parseJsonSafe(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function parseCsvText(csvText) {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') { if (csvText[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; } } else { field += ch; }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  row.push(field);
  if (row.some((v) => String(v || '').trim() !== '')) rows.push(row);
  return rows;
}

function csvRowsToObjects(csvText) {
  const rows = parseCsvText(csvText); if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const objs = [];
  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i]; if (!values || values.every((v) => String(v || '').trim() === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] == null ? '' : String(values[idx]).trim(); });
    objs.push(obj);
  }
  return objs;
}

function pickCsvValue(obj, keys, fallback = '') {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return fallback;
}

function normalizeRouteType(input) {
  const raw = String(input || '').trim(); if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'one-way' || raw === '單向') return 'One-way';
  if (lower === 'two-way' || raw === '雙向') return 'Two-way';
  if (lower === 'circular' || raw === '循環') return 'Circular';
  return raw;
}

// --- Relay Helpers ---
function buildBotRelayEndpoint() {
  if (process.env.DISCORD_BOT_ADMIN_RELAY_ENDPOINT) return process.env.DISCORD_BOT_ADMIN_RELAY_ENDPOINT;
  const syncEndpoint = process.env.DISCORD_BOT_SYNC_ENDPOINT;
  if (!syncEndpoint) return null;
  try {
    const url = new URL(syncEndpoint); url.pathname = '/api/admin-relay'; url.search = '';
    return url.toString();
  } catch (e) { return null; }
}

async function triggerDiscordBotSyncForUser(userId) {
  const endpoint = process.env.DISCORD_BOT_SYNC_ENDPOINT;
  const token = process.env.DISCORD_BOT_SYNC_TOKEN;
  if (!endpoint || !token) return;
  try {
    const { rows } = await query('SELECT discord_id FROM users WHERE id = $1', [userId]);
    const discordId = rows[0]?.discord_id; if (!discordId) return;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, discordId }),
    });
  } catch (e) {}
}

async function ensureAdminRouteSchema() {
  await query(`ALTER TABLE routes_config ADD COLUMN IF NOT EXISTS promo_cost INTEGER`);
  await query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_terminal BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS alias VARCHAR(255)`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS bg_color VARCHAR(7)`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_type VARCHAR(20) DEFAULT 'level'`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS unlock_value INTEGER`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS gpx JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS stops JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS length_text VARCHAR(32)`);
  await query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_fare NUMERIC DEFAULT 0`);
  await query(`ALTER TABLE user_game_profile ADD COLUMN IF NOT EXISTS total_saved_fare NUMERIC DEFAULT 0`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS region VARCHAR(100)`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS description TEXT`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_center_lng DOUBLE PRECISION`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS map_zoom INTEGER`);
  await query(`ALTER TABLE department_config ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE`);
}

/**
 * 驗證管理員身份
 */
function verifyAdmin(req, roleRequired = 'admin') {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'Unauthorized: Missing token', status: 401 };
  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) return { error: 'Server configuration error', status: 500 };
  try {
    const decoded = jwt.verify(token, secret);
    if (roleRequired === 'senior_admin' && decoded.role !== 'senior_admin') return { error: 'Forbidden: Senior admin access required', status: 403 };
    if (!['admin', 'senior_admin'].includes(decoded.role)) return { error: 'Forbidden: Admin access required', status: 403 };
    return { decoded };
  } catch (err) { return { error: 'Unauthorized: Invalid token', status: 401 }; }
}

// ==========================================
// AI Agent 核心引擎
// ==========================================
async function handleAiDev(req, res) {
    const { prompt, path, pin } = req.body;
    if (String(pin).trim() !== "032024") return res.status(403).json({ error: "安全授權碼錯誤。" });
    const auth = verifyAdmin(req, 'senior_admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const owner = "ctrchk", repo = "ctrchk_web";
    try {
        if (!process.env.GITHUB_TOKEN || !process.env.GEMINI_API_KEY) throw new Error("環境變數未設定。");
        let branch = 'main';
        try { const { data } = await octokit.repos.get({ owner, repo }); branch = data.default_branch; } catch (e) {}
        const { data: treeData } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: true });
        const fileList = treeData.tree.filter(f => f.type === 'blob' && !f.path.includes('.git/') && !f.path.includes('node_modules/')).map(f => f.path).join('\n');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const systemPrompt = `你是一個專業的 Full-Stack 工程特工。\n當前專案檔案列表：\n${fileList}\n\n用戶需求：${prompt}\n目標檔案：${path === "AUTO" ? "由你判斷" : path}\n\n請嚴格按格式輸出修改（支援多檔案）：\n[FILE:檔案路徑]\n完整程式碼內容\n[END_FILE]`;
        const result = await model.generateContent(systemPrompt);
        const aiResponse = result.response.text();
        const fileMatches = [...aiResponse.matchAll(/\[FILE:(.+?)\]([\s\S]*?)\[END_FILE\]/g)];
        if (fileMatches.length === 0) return res.status(500).json({ error: "AI 生成格式錯誤" });
        let count = 0, lastUrl = "";
        for (const match of fileMatches) {
            const filePath = match[1].trim(); let newCode = match[2].trim().replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
            let sha; try { const { data: f } = await octokit.repos.getContent({ owner, repo, path: filePath, ref: branch }); if (!Array.isArray(f)) sha = f.sha; } catch (e) {}
            const commit = await octokit.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message: `🤖 AI Agent Auto-Dev: ${prompt.substring(0, 50)}...`, content: Buffer.from(newCode).toString('base64'), sha, branch });
            lastUrl = commit.data.commit.html_url; count++;
        }
        return res.status(200).json({ success: true, count, commitUrl: lastUrl });
    } catch (err) { return res.status(500).json({ error: "Agent 執行錯誤: " + err.message }); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action;

  // --- 1. Discord Relay Actions (Formerly admin-relay.js) ---
  if (req.method === 'POST' && ['send', 'edit', 'delete'].includes(action)) {
    const auth = verifyAdmin(req);
    if (auth.error) return res.status(auth.status).json({ message: auth.error });
    const endpoint = buildBotRelayEndpoint(); const relayToken = process.env.DISCORD_ADMIN_RELAY_TOKEN;
    if (!endpoint || !relayToken) return res.status(503).json({ message: 'Discord relay not configured' });
    const { channelId, messageId, content, embed, limit } = req.body;
    if (!channelId) return res.status(400).json({ message: 'channelId is required' });
    try {
      const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${relayToken}` }, body: JSON.stringify({ action, channelId, messageId, content, embed, limit }) });
      const data = await resp.json().catch(() => ({}));
      return res.status(resp.status).json(data);
    } catch (e) { return res.status(500).json({ message: e.message }); }
  }

  // --- 2. AI Dev ---
  if (req.method === 'POST' && action === 'ai-dev') {
    return await handleAiDev(req, res);
  }

  // --- 3. User & Route Management (Formerly admin-users.js) ---
  const auth = verifyAdmin(req, 'senior_admin');
  if (auth.error) return res.status(auth.status).json({ message: auth.error });

  if (req.method === 'GET') {
    if (action === 'get-stations') {
      try {
        await ensureAdminRouteSchema();
        const { rows: stations } = await query(`SELECT * FROM stations ORDER BY area, station_number`);
        const { rows: routes } = await query(`SELECT dept, route_number, start_station_id, end_station_id, stops FROM routes`);
        const stationRoutes = new Map(); stations.forEach(s => stationRoutes.set(s.id, new Set()));
        routes.forEach(r => {
          const lbl = `${r.dept}-${r.route_number}`;
          [r.start_station_id, r.end_station_id].forEach(sid => { if (sid && stationRoutes.has(sid)) stationRoutes.get(sid).add(lbl); });
          parseJsonSafe(r.stops, []).forEach(s => { if (s?.station_id && stationRoutes.has(s.station_id)) stationRoutes.get(s.station_id).add(lbl); });
        });
        return res.status(200).json({ stations: stations.map(s => ({ ...s, route_refs: Array.from(stationRoutes.get(s.id) || []).sort() })) });
      } catch (e) { return res.status(500).json({ message: 'Failed' }); }
    }
    if (action === 'get-managed-routes') {
      try {
        await ensureAdminRouteSchema();
        const { rows } = await query(`SELECT r.*, s1.name_zh AS start_station_name_zh, s2.name_zh AS end_station_name_zh FROM routes r LEFT JOIN stations s1 ON s1.id = r.start_station_id LEFT JOIN stations s2 ON s2.id = r.end_station_id ORDER BY r.dept, r.route_number`);
        return res.status(200).json({ routes: rows.map(r => ({ ...r, route_id: `${r.dept}-${r.route_number}`, stops: parseJsonSafe(r.stops, []), rewards: parseJsonSafe(r.rewards, {}), tags: parseJsonSafe(r.tags, []), gpx: parseJsonSafe(r.gpx, []), route_fare: parseFloat(r.route_fare || 0) })) });
      } catch (e) { return res.status(500).json({ message: 'Failed' }); }
    }
    if (action === 'get-dept-config') {
      try { await ensureAdminRouteSchema(); const { rows } = await query(`SELECT * FROM department_config ORDER BY dept_id`); return res.status(200).json({ departments: rows }); } catch (e) { return res.status(500).json({ message: 'Failed' }); }
    }
    if (action === 'get_user_rides') {
      const { rows } = await query(`SELECT id, ride_date, route_name, distance_km, duration_minutes, xp_earned FROM cycling_history WHERE user_id = $1 ORDER BY ride_date DESC`, [req.query.user_id]);
      return res.status(200).json({ rides: rows });
    }
    // Default: list users
    try {
      await ensureAdminRouteSchema();
      const page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 20, offset = (page - 1) * limit, search = req.query.search || '';
      let where = '', params = [limit, offset];
      if (search) { where = `WHERE u.email ILIKE $3 OR u.full_name ILIKE $3 OR u.username ILIKE $3`; params.push(`%${search}%`); }
      const users = await query(`SELECT u.*, COALESCE(gp.level, 1) AS cyclist_level, COALESCE(gp.xp, 0) AS xp, COALESCE(gp.coins, 0) AS coins, COALESCE(gp.total_saved_fare, 0) AS total_saved_fare, COUNT(DISTINCT ch.id) AS ride_count, COALESCE(SUM(ch.distance_km), 0) AS total_distance, COALESCE(SUM(ch.duration_minutes), 0) AS total_duration_minutes FROM users u LEFT JOIN user_game_profile gp ON gp.user_id = u.id LEFT JOIN cycling_history ch ON u.id = ch.user_id ${where} GROUP BY u.id, gp.level, gp.xp, gp.coins, gp.total_saved_fare ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, params);
      const { rows } = await query(search ? `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR full_name ILIKE $1 OR username ILIKE $1` : `SELECT COUNT(*) FROM users`, search ? [`%${search}%`] : []);
      return res.status(200).json({ users: users.rows, pagination: { page, limit, total: parseInt(rows[0].count), totalPages: Math.ceil(parseInt(rows[0].count) / limit) } });
    } catch (e) { return res.status(500).json({ message: e.message }); }
  }

  if (req.method === 'POST') {
    const b = req.body;
    if (action === 'upsert_dept') {
        await query(`INSERT INTO department_config (dept_id, name, region, description, map_center_lat, map_center_lng, map_zoom, available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (dept_id) DO UPDATE SET name=EXCLUDED.name, region=EXCLUDED.region, description=EXCLUDED.description, map_center_lat=EXCLUDED.map_center_lat, map_center_lng=EXCLUDED.map_center_lng, map_zoom=EXCLUDED.map_zoom, available=EXCLUDED.available`, [String(b.dept_id).trim().toLowerCase(), b.name, b.region, b.description, b.map_center_lat, b.map_center_lng, b.map_zoom, b.available !== false]);
        return res.status(200).json({ success: true });
    }
    if (action === 'delete_dept') { await query(`DELETE FROM department_config WHERE dept_id = $1`, [b.dept_id]); return res.status(200).json({ success: true }); }
    if (action === 'upsert_station') { const id = buildStationId(b.area, b.station_number); await query(`INSERT INTO stations (id, area, station_number, name_zh, name_en, lat, lon, road_name, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (id) DO UPDATE SET area=EXCLUDED.area, station_number=EXCLUDED.station_number, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en, lat=EXCLUDED.lat, lon=EXCLUDED.lon, road_name=EXCLUDED.road_name, updated_at=NOW()`, [id, b.area, b.station_number, b.name_zh, b.name_en, b.lat, b.lon, b.road_name]); return res.status(200).json({ success: true, id }); }
    if (action === 'import_stations_csv') {
        const rows = csvRowsToObjects(b.csv_content); for (const r of rows) {
            const area = pickCsvValue(r, ['area']), num = parseInt(pickCsvValue(r, ['station_number', 'no']), 10), name = pickCsvValue(r, ['name_zh', 'name']), lat = Number(pickCsvValue(r, ['lat'])), lon = Number(pickCsvValue(r, ['lon']));
            if (!area || !num || !name || !lat || !lon) continue;
            await query(`INSERT INTO stations (id, area, station_number, name_zh, name_en, lat, lon, road_name, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (id) DO UPDATE SET area=EXCLUDED.area, station_number=EXCLUDED.station_number, name_zh=EXCLUDED.name_zh, name_en=EXCLUDED.name_en, lat=EXCLUDED.lat, lon=EXCLUDED.lon, road_name=EXCLUDED.road_name, updated_at=NOW()`, [buildStationId(area, num), area, num, name, pickCsvValue(r, ['name_en']), lat, lon, pickCsvValue(r, ['road_name'])]);
        }
        return res.status(200).json({ success: true });
    }
    if (action === 'delete_station') { await query(`DELETE FROM stations WHERE id = $1`, [b.station_id]); return res.status(200).json({ success: true }); }
    if (action === 'set_terminal_station') { await query(`UPDATE stations SET is_terminal = $1, updated_at = NOW() WHERE id = $2`, [!!b.is_terminal, b.station_id]); return res.status(200).json({ success: true }); }
    if (action === 'upsert_managed_route') {
        await query(`INSERT INTO routes (dept, route_number, start_station_id, end_station_id, type, stops, rewards, alias, bg_color, estimated_minutes, route_fare, unlock_type, unlock_value, tags, gpx, length_text, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,NOW()) ON CONFLICT (dept, route_number) DO UPDATE SET start_station_id=EXCLUDED.start_station_id, end_station_id=EXCLUDED.end_station_id, type=EXCLUDED.type, stops=EXCLUDED.stops, rewards=EXCLUDED.rewards, alias=EXCLUDED.alias, bg_color=EXCLUDED.bg_color, estimated_minutes=EXCLUDED.estimated_minutes, route_fare=EXCLUDED.route_fare, unlock_type=EXCLUDED.unlock_type, unlock_value=EXCLUDED.unlock_value, tags=EXCLUDED.tags, gpx=EXCLUDED.gpx, length_text=EXCLUDED.length_text, updated_at=NOW()`, [b.dept, b.route_number, b.start_station_id, b.end_station_id, b.type, JSON.stringify(b.stops || []), JSON.stringify(b.rewards || {}), b.alias, b.bg_color, b.estimated_minutes, b.route_fare || 0, b.unlock_type, b.unlock_value, JSON.stringify(b.tags || []), JSON.stringify(b.gpx || []), b.length_text]);
        return res.status(200).json({ success: true });
    }
    if (action === 'import_routes_csv') {
        const rows = csvRowsToObjects(b.csv_content); for (const r of rows) {
            const d = pickCsvValue(r, ['dept']), rn = pickCsvValue(r, ['route_number']), t = normalizeRouteType(pickCsvValue(r, ['type'])); if (!d || !rn || !t) continue;
            await query(`INSERT INTO routes (dept, route_number, start_station_id, end_station_id, type, stops, rewards, alias, bg_color, estimated_minutes, route_fare, unlock_type, unlock_value, tags, gpx, length_text, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,NOW()) ON CONFLICT (dept, route_number) DO UPDATE SET start_station_id=EXCLUDED.start_station_id, end_station_id=EXCLUDED.end_station_id, type=EXCLUDED.type, stops=EXCLUDED.stops, rewards=EXCLUDED.rewards, alias=EXCLUDED.alias, bg_color=EXCLUDED.bg_color, estimated_minutes=EXCLUDED.estimated_minutes, route_fare=EXCLUDED.route_fare, unlock_type=EXCLUDED.unlock_type, unlock_value=EXCLUDED.unlock_value, tags=EXCLUDED.tags, gpx=EXCLUDED.gpx, length_text=EXCLUDED.length_text, updated_at=NOW()`, [d, rn, pickCsvValue(r, ['start_station_id']), pickCsvValue(r, ['end_station_id']), t, pickCsvValue(r, ['stops'], '[]'), pickCsvValue(r, ['rewards'], '{}'), pickCsvValue(r, ['alias']), pickCsvValue(r, ['bg_color']), pickCsvValue(r, ['estimated_minutes']), Number(pickCsvValue(r, ['route_fare'], '0')), pickCsvValue(r, ['unlock_type'], 'level'), pickCsvValue(r, ['unlock_value']), pickCsvValue(r, ['tags'], '[]'), pickCsvValue(r, ['gpx'], '[]'), pickCsvValue(r, ['length_text'])]);
        }
        return res.status(200).json({ success: true });
    }
    if (action === 'delete_managed_route') { await query(`DELETE FROM routes WHERE dept = $1 AND route_number = $2`, [b.dept, b.route_number]); return res.status(200).json({ success: true }); }
    if (action === 'update_ride') { await query(`UPDATE cycling_history SET route_name=$1, distance_km=$2, duration_minutes=$3, updated_at=NOW() WHERE id=$4`, [b.route_name, b.distance_km, b.duration_minutes, b.ride_id]); return res.status(200).json({ success: true }); }
    if (action === 'delete_ride') { await query(`DELETE FROM cycling_history WHERE id=$1`, [b.ride_id]); return res.status(200).json({ success: true }); }
    if (action === 'set_role') { await query(`UPDATE users SET user_role=$1 WHERE id=$2`, [b.new_role, b.user_id]); await triggerDiscordBotSyncForUser(b.user_id); syncDiscordRolesForUser(b.user_id).catch(() => {}); return res.status(200).json({ success: true }); }
    if (action === 'delete_user') { await query(`DELETE FROM users WHERE id=$1`, [b.user_id]); return res.status(200).json({ success: true }); }
    if (action === 'get_game_profile') {
        const u = await query(`SELECT u.*, COALESCE(gp.level,1) as level, COALESCE(gp.xp,0) as xp, COALESCE(gp.coins,0) as coins, COALESCE(gp.mileage_km_365,0) as mileage_km_365, LOWER(COALESCE(gp.mileage_rank,'bronze')) as mileage_rank, COALESCE(gp.total_saved_fare, 0) as total_saved_fare FROM users u LEFT JOIN user_game_profile gp ON gp.user_id=u.id WHERE u.id=$1`, [b.user_id]);
        const rs = await query(`SELECT * FROM user_unlocked_routes WHERE user_id=$1`, [b.user_id]);
        return res.status(200).json({ user: u.rows[0], unlocked_routes: rs.rows });
    }
    if (action === 'set_game_stats') {
        const lvl = b.xp !== undefined ? calcLevel(b.xp) : null;
        await query(`INSERT INTO user_game_profile (user_id, level, xp, coins, mileage_km_365, mileage_rank, total_saved_fare, updated_at) VALUES ($1, COALESCE($2,1), COALESCE($3,0), COALESCE($4,0), COALESCE($5,0), COALESCE($6,'bronze'), COALESCE($7,0), NOW()) ON CONFLICT (user_id) DO UPDATE SET level=COALESCE($2, user_game_profile.level), xp=COALESCE($3, user_game_profile.xp), coins=COALESCE($4, user_game_profile.coins), mileage_km_365=COALESCE($5, user_game_profile.mileage_km_365), mileage_rank=COALESCE($6, user_game_profile.mileage_rank), total_saved_fare=COALESCE($7, user_game_profile.total_saved_fare), updated_at=NOW()`, [b.user_id, lvl, b.xp, b.coins, b.mileage_km_365, b.mileage_rank, b.total_saved_fare]);
        await triggerDiscordBotSyncForUser(b.user_id); syncDiscordRolesForUser(b.user_id).catch(() => {}); return res.status(200).json({ success: true });
    }
    if (action === 'grant_route') { await query(`INSERT INTO user_unlocked_routes (user_id, route_id, unlock_method) VALUES ($1,$2,'admin') ON CONFLICT DO NOTHING`, [b.user_id, b.route_id]); return res.status(200).json({ success: true }); }
    if (action === 'revoke_route') { await query(`DELETE FROM user_unlocked_routes WHERE user_id=$1 AND route_id=$2`, [b.user_id, b.route_id]); return res.status(200).json({ success: true }); }
    if (action === 'create_admin') {
        const h = bcrypt.hashSync(b.password, 12);
        await query(`INSERT INTO users (email, password_hash, user_role, full_name, username, profile_completed, auth_provider, email_verified) VALUES ($1,$2,$3,$4,$5,true,'email',true)`, [b.email, h, b.role || 'admin', b.full_name, b.username]);
        return res.status(201).json({ success: true });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
