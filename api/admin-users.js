// /api/admin-users.js
// 管理員 API - 查看用戶列表
import { query } from '../lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { syncDiscordRolesForUser } from '../lib/discord-role-sync.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 根據累計 XP 計算等級（與 getHistory.js 保持一致）
function calcLevel(xp) {
  const thresholds = [
    0, 80, 200, 380, 620, 950, 1400, 1980, 2700, 3600,
    4000, 5100, 6500, 8100, 10000, 12200, 14800, 17800, 21200, 25200,
    28200, 33000, 38300, 44200, 50600, 57800, 65500, 74100, 83500, 93900,
    98800, 110600, 123500, 137800, 153500, 170700, 189700, 210500, 233500, 258700,
    267300, 295800, 327100, 361500, 399400, 441100, 487000, 537500, 593000, 654000,
  ];
  const BASE_GAP = 61000;
  const GROWTH   = 1.10;
  const BASE_XP  = 654000;
  const BASE_LVL = 50;

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
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }

  row.push(field);
  if (row.some((v) => String(v || '').trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

function csvRowsToObjects(csvText) {
  const rows = parseCsvText(csvText);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const objs = [];
  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    if (!values || values.every((v) => String(v || '').trim() === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] == null ? '' : String(values[idx]).trim();
    });
    objs.push(obj);
  }
  return objs;
}

function pickCsvValue(obj, keys, fallback = '') {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return fallback;
}

function normalizeRouteType(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'one-way' || raw === '單向') return 'One-way';
  if (lower === 'two-way' || raw === '雙向') return 'Two-way';
  if (lower === 'circular' || raw === '循環') return 'Circular';
  return raw;
}

async function loadLegacyRoutesFromRepo() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(__dirname, '../routes.json'),
    path.resolve(process.cwd(), 'routes.json'),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) {}
  }
  return [];
}

function normalizeLegacyRouteToManagedRow(route) {
  const routeId = String(route?.id || '').trim();
  if (!routeId) return null;
  const dept = String(route?.dept || 'LEGACY').trim() || 'LEGACY';
  const routeNumber = routeId;
  const rawType = String(route?.type || '').toLowerCase();
  const type = rawType.includes('circular') || route?.end == null ? 'Circular' : 'Two-way';
  const rewards = {
    xp_reward: Number(route?.xp_reward || 0),
    mileage_coin_reward: Number(route?.mileage_coin_reward || 0),
    unlock_cost: Number(route?.unlock_cost || 0),
    per_stop_xp: Number(route?.per_stop_xp || 0),
    cross_district_bonus: Number(route?.cross_district_bonus || 0),
    completion_bonus: Number(route?.completion_bonus || 0),
    time_limit_bonus: Number(route?.time_limit_bonus || 0),
  };
  return {
    dept,
    route_number: routeNumber,
    type,
    start_station_id: null,
    end_station_id: null,
    stops: Array.isArray(route?.stops) ? route.stops : [],
    rewards,
    route_id: routeId,
  };
}

/**
 * 驗證管理員身份的中間件
 */
function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing token', status: 401 };
  }

  let _ensureAdminEconomyColumnsPromise = null;
  async function ensureAdminEconomyColumns() {
    if (!_ensureAdminEconomyColumnsPromise) {
      _ensureAdminEconomyColumnsPromise = (async () => {
        await query(`ALTER TABLE routes_config ADD COLUMN IF NOT EXISTS mileage_coin_reward INTEGER NOT NULL DEFAULT 0;`);
      })().catch((err) => {
        _ensureAdminEconomyColumnsPromise = null;
        throw err;
      });
    }
    await _ensureAdminEconomyColumnsPromise;
  }

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    return { error: 'Server configuration error', status: 500 };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'senior_admin') {
      return { error: 'Forbidden: Senior admin access required', status: 403 };
    }
    return { decoded };
  } catch (err) {
    return { error: 'Unauthorized: Invalid token', status: 401 };
  }
}

async function triggerDiscordBotSyncForUser(userId) {
  const endpoint = process.env.DISCORD_BOT_SYNC_ENDPOINT;
  const token = process.env.DISCORD_BOT_SYNC_TOKEN;
  if (!endpoint || !token) return;
  try {
    const { rows } = await query('SELECT discord_id FROM users WHERE id = $1', [userId]);
    const discordId = rows[0]?.discord_id;
    if (!discordId) return;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, discordId }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`[admin-users] Discord bot sync failed: ${resp.status} ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.warn('[admin-users] Failed to trigger Discord bot sync:', e.message);
  }
}

export default async function handler(req, res) {
  // CORS headers for admin panel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 驗證管理員
  const authResult = verifyAdmin(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ message: authResult.error });
  }
  await ensureAdminEconomyColumns();

  // GET: 獲取用戶列表 / 部門與路線配置
  if (req.method === 'GET') {
    if (req.query.action === 'get-stations') {
      try {
        const { rows: stations } = await query(
          `SELECT id, area, station_number, name_zh, name_en, lat, lon, road_name
           FROM stations
           ORDER BY area, station_number`
        );
        const { rows: routes } = await query(
          `SELECT dept, route_number, start_station_id, end_station_id, stops
           FROM routes`
        );
        const stationRoutes = new Map();
        for (const st of stations) stationRoutes.set(st.id, new Set());
        for (const r of routes) {
          const routeLabel = `${r.dept}-${r.route_number}`;
          [r.start_station_id, r.end_station_id].forEach((sid) => {
            if (sid && stationRoutes.has(sid)) stationRoutes.get(sid).add(routeLabel);
          });
          const stops = parseJsonSafe(r.stops, []);
          if (Array.isArray(stops)) {
            stops.forEach((s) => {
              const sid = s?.station_id;
              if (sid && stationRoutes.has(sid)) stationRoutes.get(sid).add(routeLabel);
            });
          }
        }
        return res.status(200).json({
          stations: stations.map((s) => ({
            ...s,
            route_refs: Array.from(stationRoutes.get(s.id) || []).sort(),
          })),
        });
      } catch (e) {
        console.error('[admin-users] get-stations error:', e.message);
        return res.status(500).json({ message: '載入站點失敗', stations: [] });
      }
    }

    if (req.query.action === 'get-managed-routes') {
      try {
        const { rows } = await query(
          `SELECT r.dept, r.route_number, r.start_station_id, r.end_station_id, r.type, r.stops, r.rewards,
                  s1.name_zh AS start_station_name_zh, s2.name_zh AS end_station_name_zh
           FROM routes r
           LEFT JOIN stations s1 ON s1.id = r.start_station_id
           LEFT JOIN stations s2 ON s2.id = r.end_station_id
           ORDER BY r.dept, r.route_number`
        );
        return res.status(200).json({
          routes: rows.map((r) => ({
            ...r,
            route_id: `${r.dept}-${r.route_number}`,
            stops: parseJsonSafe(r.stops, []),
            rewards: parseJsonSafe(r.rewards, {}),
          })),
        });
      } catch (e) {
        console.error('[admin-users] get-managed-routes error:', e.message);
        return res.status(500).json({ message: '載入路線失敗', routes: [] });
      }
    }

    // GET department configs
    if (req.query.action === 'get-dept-config') {
      try {
        const { rows } = await query('SELECT dept_id, name, unlock_cost, promo_cost, is_promo FROM department_config ORDER BY dept_id');
        return res.status(200).json({ departments: rows });
      } catch (e) {
        console.error('[admin-users] get-dept-config error:', e.message);
        return res.status(500).json({ message: '載入部門設定失敗', departments: [] });
      }
    }

    // GET route configs (coin routes only)
    if (req.query.action === 'get-route-config') {
      try {
        const { rows } = await query(`SELECT route_id, unlock_cost, promo_cost, is_special FROM routes_config WHERE is_special = TRUE ORDER BY route_id`);
        return res.status(200).json({ routes: rows });
      } catch (e) {
        console.error('[admin-users] get-route-config error:', e.message);
        return res.status(500).json({ message: '載入路線設定失敗', routes: [] });
      }
    }

    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let whereClause = '';
      let params = [limit, offset];
      
      if (search) {
        whereClause = `WHERE u.email ILIKE $3 OR u.full_name ILIKE $3 OR u.username ILIKE $3`;
        params.push(`%${search}%`);
      }

      // 獲取用戶列表（不含密碼）
      const usersResult = await query(
        `SELECT 
          u.id,
          u.email,
          u.username,
          u.full_name,
          u.user_role,
          COALESCE(gp.level, 1) AS cyclist_level,
          u.phone,
          u.experience,
          u.preferred_area,
          u.profile_completed,
          u.email_verified,
          u.auth_provider,
          u.created_at,
          COUNT(DISTINCT ch.id) AS ride_count,
          COALESCE(SUM(ch.distance_km), 0) AS total_distance
         FROM users u
         LEFT JOIN user_game_profile gp ON gp.user_id = u.id
          LEFT JOIN cycling_history ch ON u.id = ch.user_id
          ${whereClause}
         GROUP BY u.id, gp.level
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      // 獲取總用戶數
      const countResult = await query(
        search 
          ? `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR full_name ILIKE $1 OR username ILIKE $1`
          : `SELECT COUNT(*) FROM users`,
        search ? [`%${search}%`] : []
      );

      const total = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        users: usersResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Admin get users error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  // POST: 修改用戶角色
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { action } = body;

      // Update department config (standard price + promo settings)
      if (action === 'update-dept-config') {
        const { dept_id, is_promo, promo_cost, unlock_cost } = body;
        if (!dept_id) return res.status(400).json({ message: 'dept_id is required' });
        await query(
          `UPDATE department_config SET unlock_cost = COALESCE($1, unlock_cost), is_promo = $2, promo_cost = $3 WHERE dept_id = $4`,
          [
            unlock_cost != null ? parseInt(unlock_cost, 10) : null,
            is_promo,
            promo_cost != null ? parseInt(promo_cost, 10) : null,
            dept_id,
          ]
        );
        return res.status(200).json({ success: true });
      }


      // Update route promo price
      if (action === 'update-route-promo') {
        const { route_id, promo_cost } = body;
        if (!route_id) return res.status(400).json({ message: 'route_id is required' });
        await query(
          `UPDATE routes_config SET promo_cost = $1 WHERE route_id = $2`,
          [promo_cost != null ? parseInt(promo_cost, 10) : null, route_id]
        );
        return res.status(200).json({ success: true });
      }

      if (action === 'upsert_station') {
        const { area, station_number, name_zh, name_en, lat, lon, road_name } = body;
        const stationNumber = parseInt(station_number, 10);
        if (!area || !Number.isFinite(stationNumber) || stationNumber <= 0 || !name_zh) {
          return res.status(400).json({ message: 'area, station_number, name_zh 為必填欄位' });
        }
        const latNum = Number(lat);
        const lonNum = Number(lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
          return res.status(400).json({ message: 'lat/lon 格式無效' });
        }
        const id = buildStationId(area, stationNumber);
        await query(
          `INSERT INTO stations (id, area, station_number, name_zh, name_en, lat, lon, road_name, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
           ON CONFLICT (id) DO UPDATE SET
             area = EXCLUDED.area,
             station_number = EXCLUDED.station_number,
             name_zh = EXCLUDED.name_zh,
             name_en = EXCLUDED.name_en,
             lat = EXCLUDED.lat,
             lon = EXCLUDED.lon,
             road_name = EXCLUDED.road_name,
             updated_at = NOW()`,
          [id, String(area).trim().toUpperCase(), stationNumber, name_zh, name_en || null, latNum, lonNum, road_name || null]
        );
        return res.status(200).json({ success: true, id });
      }

      if (action === 'import_stations_csv') {
        const csvContent = String(body.csv_content || '');
        if (!csvContent.trim()) {
          return res.status(400).json({ message: 'csv_content is required' });
        }
        const rows = csvRowsToObjects(csvContent);
        if (!rows.length) {
          return res.status(400).json({ message: 'CSV 內容為空或格式無效' });
        }
        let imported = 0;
        let failed = 0;
        const errors = [];
        for (let i = 0; i < rows.length; i += 1) {
          const lineNo = i + 2;
          const r = rows[i];
          try {
            const area = pickCsvValue(r, ['area']);
            const stationNumberRaw = pickCsvValue(r, ['station_number', 'stationnumber', 'number', 'no']);
            const nameZh = pickCsvValue(r, ['name_zh', 'namezh', 'name']);
            const nameEn = pickCsvValue(r, ['name_en', 'nameen'], null);
            const latRaw = pickCsvValue(r, ['lat', 'latitude']);
            const lonRaw = pickCsvValue(r, ['lon', 'lng', 'longitude']);
            const roadName = pickCsvValue(r, ['road_name', 'roadname', 'road'], null);

            const stationNumber = parseInt(stationNumberRaw, 10);
            const latNum = Number(latRaw);
            const lonNum = Number(lonRaw);
            if (!area || !Number.isFinite(stationNumber) || stationNumber <= 0 || !nameZh || !Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
              throw new Error('欄位不足或格式錯誤（需要 area, station_number, name_zh, lat, lon）');
            }
            const id = buildStationId(area, stationNumber);
            await query(
              `INSERT INTO stations (id, area, station_number, name_zh, name_en, lat, lon, road_name, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
               ON CONFLICT (id) DO UPDATE SET
                 area = EXCLUDED.area,
                 station_number = EXCLUDED.station_number,
                 name_zh = EXCLUDED.name_zh,
                 name_en = EXCLUDED.name_en,
                 lat = EXCLUDED.lat,
                 lon = EXCLUDED.lon,
                 road_name = EXCLUDED.road_name,
                 updated_at = NOW()`,
              [id, String(area).trim().toUpperCase(), stationNumber, nameZh, nameEn || null, latNum, lonNum, roadName || null]
            );
            imported += 1;
          } catch (e) {
            failed += 1;
            if (errors.length < 20) errors.push(`第 ${lineNo} 行：${e.message}`);
          }
        }
        return res.status(200).json({ success: true, imported, failed, errors });
      }

      if (action === 'delete_station') {
        const { station_id } = body;
        if (!station_id) return res.status(400).json({ message: 'station_id is required' });
        const { rowCount } = await query(`DELETE FROM stations WHERE id = $1`, [station_id]);
        if (!rowCount) return res.status(404).json({ message: 'Station not found' });
        return res.status(200).json({ success: true });
      }

      if (action === 'upsert_managed_route') {
        const {
          dept,
          route_number,
          start_station_id,
          end_station_id,
          type,
          stops,
          rewards,
        } = body;
        if (!dept || !route_number || !start_station_id || !end_station_id || !type) {
          return res.status(400).json({ message: 'dept, route_number, start_station_id, end_station_id, type 為必填' });
        }
        const validTypes = ['One-way', 'Two-way', 'Circular'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ message: 'type 必須為 One-way / Two-way / Circular' });
        }
        const safeStops = Array.isArray(stops) ? stops : [];
        const safeRewards = rewards && typeof rewards === 'object' ? rewards : {};
        await query(
          `INSERT INTO routes
            (dept, route_number, start_station_id, end_station_id, type, stops, rewards, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW())
           ON CONFLICT (dept, route_number) DO UPDATE SET
             start_station_id = EXCLUDED.start_station_id,
             end_station_id = EXCLUDED.end_station_id,
             type = EXCLUDED.type,
             stops = EXCLUDED.stops,
             rewards = EXCLUDED.rewards,
             updated_at = NOW()`,
          [
            String(dept).trim(),
            String(route_number).trim(),
            String(start_station_id).trim(),
            String(end_station_id).trim(),
            type,
            JSON.stringify(safeStops),
            JSON.stringify(safeRewards),
          ]
        );
        const routeIdForConfig = String(route_number).trim();
        const xpReward = Number(safeRewards.xp_reward || 0);
        const mileageCoinReward = Number(safeRewards.mileage_coin_reward || 0);
        const unlockCostRaw = Number(safeRewards.unlock_cost || 0);
        const unlockCost = unlockCostRaw > 0 ? unlockCostRaw : null;
        await query(
          `INSERT INTO routes_config (route_id, unlock_level, unlock_cost, xp_reward, mileage_coin_reward, is_special)
           VALUES ($1, 1, $2, $3, $4, $5)
           ON CONFLICT (route_id) DO UPDATE SET
             unlock_cost = EXCLUDED.unlock_cost,
             xp_reward = EXCLUDED.xp_reward,
             mileage_coin_reward = EXCLUDED.mileage_coin_reward,
             is_special = EXCLUDED.is_special`,
          [routeIdForConfig, unlockCost, xpReward, mileageCoinReward, unlockCost != null]
        );
        return res.status(200).json({ success: true });
      }

      if (action === 'import_routes_csv') {
        const csvContent = String(body.csv_content || '');
        if (!csvContent.trim()) {
          return res.status(400).json({ message: 'csv_content is required' });
        }
        const rows = csvRowsToObjects(csvContent);
        if (!rows.length) {
          return res.status(400).json({ message: 'CSV 內容為空或格式無效' });
        }
        let imported = 0;
        let failed = 0;
        const errors = [];
        for (let i = 0; i < rows.length; i += 1) {
          const lineNo = i + 2;
          const r = rows[i];
          try {
            const dept = pickCsvValue(r, ['dept', 'department']);
            const routeNumber = pickCsvValue(r, ['route_number', 'routenumber', 'route']);
            const startStationId = pickCsvValue(r, ['start_station_id', 'start_station', 'start']);
            const endStationId = pickCsvValue(r, ['end_station_id', 'end_station', 'end']);
            const type = normalizeRouteType(pickCsvValue(r, ['type']));
            if (!dept || !routeNumber || !startStationId || !endStationId || !type) {
              throw new Error('欄位不足（需要 dept, route_number, start_station_id, end_station_id, type）');
            }
            const validTypes = ['One-way', 'Two-way', 'Circular'];
            if (!validTypes.includes(type)) {
              throw new Error('type 必須為 One-way / Two-way / Circular（或 單向/雙向/循環）');
            }

            const stopsRaw = pickCsvValue(r, ['stops'], '[]');
            const rewardsRaw = pickCsvValue(r, ['rewards'], '{}');
            let safeStops = [];
            let safeRewards = {};
            try {
              safeStops = parseJsonSafe(stopsRaw, []);
              if (!Array.isArray(safeStops)) safeStops = [];
            } catch (_) {
              safeStops = [];
            }
            try {
              safeRewards = parseJsonSafe(rewardsRaw, {});
              if (!safeRewards || typeof safeRewards !== 'object' || Array.isArray(safeRewards)) safeRewards = {};
            } catch (_) {
              safeRewards = {};
            }

            await query(
              `INSERT INTO routes
                (dept, route_number, start_station_id, end_station_id, type, stops, rewards, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW())
               ON CONFLICT (dept, route_number) DO UPDATE SET
                 start_station_id = EXCLUDED.start_station_id,
                 end_station_id = EXCLUDED.end_station_id,
                 type = EXCLUDED.type,
                 stops = EXCLUDED.stops,
                 rewards = EXCLUDED.rewards,
                 updated_at = NOW()`,
              [
                String(dept).trim(),
                String(routeNumber).trim(),
                String(startStationId).trim(),
                String(endStationId).trim(),
                type,
                JSON.stringify(safeStops),
                JSON.stringify(safeRewards),
              ]
            );
            imported += 1;
          } catch (e) {
            failed += 1;
            if (errors.length < 20) errors.push(`第 ${lineNo} 行：${e.message}`);
          }
        }
        return res.status(200).json({ success: true, imported, failed, errors });
      }

      if (action === 'delete_managed_route') {
        const { dept, route_number } = body;
        if (!dept || !route_number) return res.status(400).json({ message: 'dept and route_number are required' });
        const { rowCount } = await query(`DELETE FROM routes WHERE dept = $1 AND route_number = $2`, [dept, route_number]);
        if (!rowCount) return res.status(404).json({ message: 'Route not found' });
        return res.status(200).json({ success: true });
      }

      const { user_id, new_role } = body;

      if (!action) {
        return res.status(400).json({ message: 'action is required' });
      }

      const actionsRequiringUserId = new Set([
        'set_role',
        'delete_user',
        'get_game_profile',
        'set_game_stats',
        'grant_route',
        'revoke_route',
      ]);
      if (actionsRequiringUserId.has(action) && !user_id) {
        return res.status(400).json({ message: 'user_id is required' });
      }

      if (action === 'set_role') {
        const validRoles = ['junior', 'senior', 'vip', 'admin', 'senior_admin'];
        if (!validRoles.includes(new_role)) {
          return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        await query(
          `UPDATE users SET user_role = $1 WHERE id = $2`,
          [new_role, user_id]
        );
        await triggerDiscordBotSyncForUser(user_id);
        syncDiscordRolesForUser(user_id).catch(e =>
          console.warn('[admin-users] Discord role sync failed:', e.message)
        );

        return res.status(200).json({ message: `User ${user_id} role updated to ${new_role}` });
      }

      if (action === 'delete_user') {
        await query(`DELETE FROM users WHERE id = $1`, [user_id]);
        return res.status(200).json({ message: `User ${user_id} deleted` });
      }

      if (action === 'get_game_profile') {
        // 取得指定用戶的遊戲資料（等級、XP、里程幣、已解鎖路線）
        const userResult = await query(
          `SELECT u.id, u.email, u.full_name,
                  COALESCE(gp.level, 1)  AS level,
                  COALESCE(gp.xp,    0)  AS xp,
                  COALESCE(gp.coins, 0)  AS coins
           FROM users u
           LEFT JOIN user_game_profile gp ON gp.user_id = u.id
           WHERE u.id = $1`,
          [user_id]
        );
        if (userResult.rows.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        const routesResult = await query(
          `SELECT route_id, unlock_method, unlocked_at
           FROM user_unlocked_routes
           WHERE user_id = $1
           ORDER BY unlocked_at ASC`,
          [user_id]
        );

        return res.status(200).json({
          user: userResult.rows[0],
          unlocked_routes: routesResult.rows
        });
      }

      if (action === 'set_game_stats') {
        // 更新用戶的 XP、里程幣（等級由 XP 自動計算）
        const { xp, coins } = req.body;

        if (xp === undefined && coins === undefined) {
          return res.status(400).json({ message: 'At least one of xp, coins must be provided' });
        }
        if (xp !== undefined && (typeof xp !== 'number' || xp < 0)) {
          return res.status(400).json({ message: 'xp must be a non-negative number' });
        }
        if (coins !== undefined && (typeof coins !== 'number' || coins < 0)) {
          return res.status(400).json({ message: 'coins must be a non-negative number' });
        }

        // 若有提供 XP，自動計算對應等級
        let newLevel = undefined;
        if (xp !== undefined) {
          newLevel = calcLevel(xp);
        }

        // 確保 user_game_profile 列存在，並更新
        await query(
          `INSERT INTO user_game_profile (user_id, level, xp, coins, updated_at)
           VALUES ($1, COALESCE($2, 1), COALESCE($3, 0), COALESCE($4, 0), NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             level      = CASE WHEN $2 IS NOT NULL THEN $2 ELSE user_game_profile.level END,
             xp         = CASE WHEN $3 IS NOT NULL THEN $3 ELSE user_game_profile.xp   END,
             coins      = CASE WHEN $4 IS NOT NULL THEN $4 ELSE user_game_profile.coins END,
             updated_at = NOW()`,
          [user_id,
           newLevel !== undefined ? newLevel : null,
           xp    !== undefined ? xp    : null,
           coins !== undefined ? coins : null]
        );
        await triggerDiscordBotSyncForUser(user_id);
        syncDiscordRolesForUser(user_id).catch(e =>
          console.warn('[admin-users] Discord role sync failed:', e.message)
        );

        return res.status(200).json({ message: `User ${user_id} game stats updated`, level: newLevel });
      }

      if (action === 'grant_route') {
        const { route_id } = req.body;
        if (!route_id) {
          return res.status(400).json({ message: 'route_id is required' });
        }

        await query(
          `INSERT INTO user_unlocked_routes (user_id, route_id, unlock_method, unlocked_at)
           VALUES ($1, $2, 'admin', NOW())
           ON CONFLICT (user_id, route_id) DO NOTHING`,
          [user_id, route_id]
        );

        return res.status(200).json({ message: `Route ${route_id} granted to user ${user_id}` });
      }

      if (action === 'revoke_route') {
        const { route_id } = req.body;
        if (!route_id) {
          return res.status(400).json({ message: 'route_id is required' });
        }

        await query(
          `DELETE FROM user_unlocked_routes WHERE user_id = $1 AND route_id = $2`,
          [user_id, route_id]
        );

        return res.status(200).json({ message: `Route ${route_id} revoked from user ${user_id}` });
      }

      if (action === 'create_admin') {
        const { email, full_name, password, username, role = 'admin' } = req.body;

        if (!email || !full_name || !password) {
          return res.status(400).json({ message: 'Email, name, and password are required' });
        }
        if (password.length < 12) {
          return res.status(400).json({ message: 'Admin password must be at least 12 characters' });
        }
        const validRoles = ['admin', 'senior_admin', 'senior', 'vip'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }

        // Validate username if provided
        let normalizedUsername = null;
        if (username) {
          normalizedUsername = String(username).trim();
          if (!/^[A-Za-z0-9_]{4,16}$/.test(normalizedUsername)) {
            return res.status(400).json({ message: 'Username must be 4-16 characters (letters, numbers, underscore)' });
          }
          const { rows: uRows } = await query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [normalizedUsername]
          );
          if (uRows.length > 0) {
            return res.status(409).json({ message: 'Username already taken' });
          }
        }

        const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
          return res.status(409).json({ message: 'Email already exists' });
        }

        const salt = bcrypt.genSaltSync(12);
        const password_hash = bcrypt.hashSync(password, salt);

        await query(
          `INSERT INTO users (
            email, password_hash, user_role, full_name, username, profile_completed,
            auth_provider, email_verified
          ) VALUES ($1, $2, $3, $4, $5, true, 'email', true)`,
          [email, password_hash, role, full_name, normalizedUsername]
        );

        return res.status(201).json({
          message: `${role === 'senior_admin' ? '高級管理員' : role === 'admin' ? '管理員' : role === 'vip' ? 'VIP 會員' : '高級會員'}帳戶建立成功`,
          email,
          role
        });
      }

      return res.status(400).json({ message: `Unknown action: ${action}` });

    } catch (error) {
      console.error('Admin action error:', error);
      return res.status(500).json({ message: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
