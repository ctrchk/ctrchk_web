# ADMIN SETUP GUIDE (Dummy-Proof)

This guide is for **manual setup** when Neon/Vercel are not directly managed by the coding agent.

---

## 1) Neon DB Setup Tutorial (For Beginners)

## A. Exactly where to click in Neon

1. Open **https://console.neon.tech**
2. Log in
3. Click your project (the one used by this website)
4. In the left sidebar, click **SQL Editor**
5. Click **New query** (if a blank editor is not already open)
6. Paste the SQL below
7. Click **Run** (top-right)
8. Wait for success message (no red error)

## B. Exact SQL to copy-paste

```sql
CREATE TABLE IF NOT EXISTS stations (
  id             VARCHAR(20) PRIMARY KEY, -- e.g. TKO01
  area           VARCHAR(20) NOT NULL,
  station_number INTEGER NOT NULL CHECK (station_number > 0),
  name_zh        VARCHAR(255) NOT NULL,
  name_en        VARCHAR(255),
  lat            DOUBLE PRECISION NOT NULL,
  lon            DOUBLE PRECISION NOT NULL,
  coordinates    POINT GENERATED ALWAYS AS (POINT(lon, lat)) STORED,
  road_name      VARCHAR(255),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(area, station_number),
  CHECK (id = UPPER(area) || LPAD(station_number::TEXT, 2, '0'))
);

CREATE INDEX IF NOT EXISTS idx_stations_area ON stations(area);

CREATE TABLE IF NOT EXISTS routes (
  dept              VARCHAR(50) NOT NULL,
  route_number      VARCHAR(50) NOT NULL,
  start_station_id  VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
  end_station_id    VARCHAR(20) REFERENCES stations(id) ON DELETE RESTRICT,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('One-way', 'Two-way', 'Circular')),
  stops             JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewards           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (dept, route_number)
);

CREATE INDEX IF NOT EXISTS idx_routes_start_station ON routes(start_station_id);
CREATE INDEX IF NOT EXISTS idx_routes_end_station ON routes(end_station_id);
```

## C. Quick SQL verification in Neon

After running, execute this:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('stations', 'routes');
```

You should see **2 rows**: `stations` and `routes`.

---

## 2) Environment Variables Guide

## A. Required variables (local + Vercel)

Use these:

- `DATABASE_URL` (**required**)
- `JWT_SECRET` (**required**)

Optional fallback variables supported by this repo:

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`

> Current code reads connection string in this order: `POSTGRES_URL` → `POSTGRES_PRISMA_URL` → `DATABASE_URL`.
> For Neon direct usage, set **DATABASE_URL** at minimum.

## B. Where to copy `DATABASE_URL` from Neon

1. Open **console.neon.tech**
2. Select your project
3. Click **Dashboard** (or **Connection Details**)
4. Find **Connection string**
5. Copy the **pooled** PostgreSQL URI (recommended)
6. Ensure it includes SSL (Neon requires SSL; usually already included)

## C. Where to paste env vars in Vercel

1. Open **https://vercel.com/dashboard**
2. Select this project
3. Click **Settings**
4. Click **Environment Variables**
5. Add:
   - Name: `DATABASE_URL` → Value: (paste Neon connection string)
   - Name: `JWT_SECRET` → Value: (long random secret, 32+ chars)
6. For each variable, set environments:
   - **Production**
   - **Preview**
   - **Development**
7. Click **Save**
8. Redeploy (or trigger a new deployment) so updated env vars take effect

## D. `.env.local` example (local development)

Create file: `/home/runner/work/ctrchk_web/ctrchk_web/.env.local`

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
JWT_SECRET=<your-long-random-secret>
```

---

## 3) Step-by-Step Verification

## A. Local run checklist

1. Open terminal in repo:
   - `/home/runner/work/ctrchk_web/ctrchk_web`
2. Install deps:
   - `npm install`
3. Ensure `.env.local` exists with `DATABASE_URL` + `JWT_SECRET`
4. Start local serverless runtime:
   - `vercel dev`
5. Open browser:
   - `http://localhost:3000/admin.html`
6. Log in with a **senior_admin** account
7. Go to **路線管理 (Route Management)** tab
8. Test:
   - Create station (Station Management)
   - Create route (Route Management)
   - Edit route
   - Delete station/route

## B. Verify DB writes in Neon SQL Editor

Run:

```sql
SELECT id, area, station_number, name_zh
FROM stations
ORDER BY area, station_number
LIMIT 20;

SELECT dept, route_number, type
FROM routes
ORDER BY dept, route_number
LIMIT 20;
```

If rows appear, the Admin Dashboard is connected correctly.

## C. Error code troubleshooting (very common)

### 500 Internal Server Error
Likely causes:
- Missing/invalid `DATABASE_URL`
- DB table not created
- SQL constraint violation

Fix:
1. Re-check env vars in Vercel/`.env.local`
2. Re-run SQL table creation in Neon
3. Restart `vercel dev` (local) or redeploy (Vercel)

### 401 / 403
Likely causes:
- Token expired/invalid
- Not logged in as `senior_admin`
- `JWT_SECRET` changed, old token became invalid

Fix:
1. Logout/login again
2. Use correct admin account
3. If `JWT_SECRET` changed, all users must re-login

### Network Error / Failed to fetch
Likely causes:
- `vercel dev` is not running
- Wrong URL/port
- Browser hitting static server instead of Vercel serverless runtime

Fix:
1. Confirm terminal shows `vercel dev` running
2. Use exactly `http://localhost:3000`
3. Hard refresh browser

### 404 on `/api/...`
Likely causes:
- Not running via Vercel dev runtime

Fix:
1. Stop current server
2. Run `vercel dev`
3. Retry

---

## 4) Next Steps Checklist (Phase 1 / 2 / 3)

## Phase 1 — Foundation (DB + Admin CRUD)

- [ ] Neon `stations` table created
- [ ] Neon `routes` table created
- [ ] `DATABASE_URL` added to Vercel + `.env.local`
- [ ] `JWT_SECRET` added to Vercel + `.env.local`
- [ ] Admin can create/edit/delete stations
- [ ] Admin can create/edit/delete managed routes

## Phase 2 — Ranking & Rewards Integration

- [ ] Link managed route rewards JSON to runtime XP rules where needed
- [ ] Add server-side validation for stop metadata shape in `routes.stops`
- [ ] Add audit fields/logging for admin updates
- [ ] Add admin filters/search for stations/routes
- [ ] Confirm multiplier behavior:
  - [ ] Tourism = x1.5
  - [ ] Commuter/DRT = x1.0
  - [ ] Free mode = x0.8

## Phase 3 — Hardening + Operations

- [ ] Add backup/export workflow for `stations` and `routes`
- [ ] Add rollback SQL snippets for emergency revert
- [ ] Add smoke-test checklist for each deployment
- [ ] Add permission review (senior_admin-only write actions)
- [ ] Document production incident runbook (DB connection/API errors)

---

## Final Note

If you follow this guide exactly in order (Neon SQL → env vars → local verify), setup risk is very low.
If something fails, start from section **3C** and fix top-down.
