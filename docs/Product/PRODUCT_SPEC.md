# CTRC HK (City Transport Cycling Hong Kong) Product Specification

This document provides a comprehensive, technical, and architectural specification of the City Transport Cycling Hong Kong (CTRC HK) platform, reflecting the system architecture, features, and core mechanics as of version v2.1.1 Beta (2026).

---

## 1. Product Overview & Strategic Vision

CTRC HK is a professional, gamified cycling navigation and community platform tailored for urban cyclists in Hong Kong. It aims to bridge the gap between green transport, gaming, and real-time physical-digital utilities.

### 1.1 Core Mission
* **Urban Decarbonization (城市減碳)**: Promote cycling as a viable, healthy, and sustainable urban transport alternative.
* **Smart Navigation (智慧出行)**: Deliver high-precision, cycle-track-priority routing to ensure safety and comfort in dense urban spaces.
* **Gamification of Athletics (騎行遊戲化)**: Incentivize long-term cyclist engagement using level progress, title ranks, rolling milestones, and virtual rewards.

### 1.2 Dual-Platform Architecture
The system operates as a single codebase but divides interfaces dynamically based on the access environment:
1. **Web Mode (Browser-only)**:
   - Primarily serves public brand marketing, routes catalogs (unlocked previews), community blogs, and GPX file downloads.
   - Hides live navigation, standard/free ride trackers, and other active, PWA-only tools.
2. **PWA Mode (App/Standalone)**:
   - Features a high-performance Industrial HUD interface.
   - Includes real-time tracking, live turn-by-turn navigation, multiplayer rooms, and background Wake Lock features.
   - Uses the PWA-specific bottom navigation bar.

---

## 2. Core Game & Economic Mechanics (The Three-Track Economy)

CTRC HK implements a strict, multi-tiered economic loop to reward consistency and prevent fraudulent behavior.

```
                  ┌───────────────────────────────┐
                  │      CYCLED DISTANCE (km)     │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [ LEVEL / EXP TRACK ]    [ MILEAGE CARD TRACK ]    [ COINS ECONOMIC TRACK ]
  - Proportional EXP       - 365-day rolling km      - Sign-in / Gacha / Level Up
  - 50+ level configs      - Bronze / Silver / Gold  - Used for special route unlocks
  - Titles (Rookie-Legend) - Tier-specific benefits  - Streak repair (100 Coins)
```

### 2.1 Level / EXP Track (經驗值與等級)
* **EXP Accumulation Formulas**:
  - **Travel Mode (旅遊模式)**: Distance $\times$ multiplier of $1.5$.
  - **Commute/DRT Mode (通勤模式)**: Distance $\times$ multiplier of $1.0$.
  - **Free Mode (自由模式)**: Distance $\times$ multiplier of $0.8$ (XP awarded starting from $0.2\text{ km}$).
  - **Dopamine Gacha (盲盒隨機獎勵)**: Generates random $+1\sim10\text{ EXP}$ at the end of valid rides.
* **Levels progression**:
  - Over 50 levels defined in `routes.json`. Beyond level 50, EXP requirements scale exponentially.
  - **Title System**:
    - `Lv.1 - 5`: 入門車手 (Rookie Rider)
    - `Lv.6 - 15`: 初階車手 (Novice Rider)
    - `Lv.16 - 30`: 進階車手 (Intermediate Rider)
    - `Lv.31 - 50`: 資深車手 (Senior Rider)
    - `Lv.51 - 75`: 精英車手 (Elite Rider)
    - `Lv.76+`: 頂尖車手 (Legendary Rider)

### 2.2 Mileage Card Track (365天滾動里程卡)
Memberships are based on active, rolling $365$-day mileage. Older mileage drops off daily, promoting continuous cycling.
* **Bronze (銅卡)**: $0\text{ km}$ threshold. Lifetime membership. Standard 2D navigation and stats.
* **Silver (銀卡)**: $\ge 150\text{ km}$ ($365$-day rolling). Drops to Bronze if $< 120\text{ km}$. Unlocks CYCPARKSPACE layer, up to 5 multi-stop waypoints, and $+5\%$ Coin bonus.
* **Gold (金卡)**: $\ge 500\text{ km}$ ($365$-day rolling). Drops to Silver if $< 400\text{ km}$. Unlocks Mapbox 3D navigation (neon cyan theme, 3D buildings), extreme high-contrast Black Gold theme, and $+15\%$ Coin bonus.

### 2.3 Coins Economic Track (里程幣)
* **Earning**: Acquired through level-ups, route completions, and dopamine gacha boxes.
* **Utility**: Used to purchase "Special routes" from the catalog. High-tier members (Silver $+5\%$, Gold $+15\%$) receive permanent earnings multipliers.
* **Streak Repair**: Spending $100\text{ Coins}$ repairs a broken daily commute streak.

---

## 3. High-Fidelity & Hardware Integrations

### 3.1 Advanced Cycle-Track Navigation
* **Brouter Custom Router**: Dynamically routes via dedicated cycle paths, giving a 100x weight penalty to push-bike paths and fully avoiding highway segments. Uses OSRM as a failover.
* **GPS Snapping & Stability**: GPS readings are snapped to the center line of the nearest cycle-track node. Under low speeds ($<3\text{ km/h}$), the map bearing snaps directly to the path segment to avoid GPS drift-induced spinning.
* **Industrial HUD**: Follows z-index structural safety guidelines: `.hud-top` (navigation directives), `.hud-left` (live speed and ETA metrics), and `.hud-bottom` (Exit / End controls).

### 3.2 Mobile-Specific Integrations
* **Screen Wake Lock API**: Holds screens on during active rides and navigation.
* **Local Web Push Notifications**: Notifies PWA users about stops or approaching checkpoints even if the screen is locked (supporting iOS standalone requirements).
* **High-Res Poster Export**: Generates vertical $1080\times1350$ PNG posters showing paths, average speed, elapsed time, and official CTRC HK branding.

---

## 4. Community & High-Value Subsystems

### 4.1 Multiplayer Rooms System
* Fully replaces the legacy friend toggle with a rooms system.
* Cyclists can create Public or Password-protected private rooms.
* Real-time location sharing of all room participants is synchronized via a `room` parameter during heartbeat checks in `ride.html`.
* Supports Session Resumption: `roomCode` is saved in unfinished ride cards so disconnected riders can quickly rejoin their active rooms.

### 4.2 Apple Wallet & Google Wallet Integration
* Uses the permanent, free-tier WalletWallet API without requiring Apple Developer account fees.
* Dynamic template styling: Gold (`#F0D372`), Silver (`#D1D9DF`), Bronze (`#D8A56B`).
* Dynamically resolves absolute logo URLs (`/images/icon-192.png`) to avoid cross-origin fetching errors.
* Generates passes with real-time rolling mileage, active rank, and user-specific QR codes.

### 4.3 3D Virtual Badges Showcase
* Uses `<model-viewer>` in `profile.html` to load and render GLB/USDZ models in real 3D.
* Models are selected via drop-downs in `admin_badges.html` directly from server folders (`/model/glb` and `/model/usdz`).

### 4.4 The Hong Kong Challenge
* A premium challenge track divided into 3 levels: 30km, 60km, and 100km.
* Accessed through a golden trophy icon in the catalog header on `routes.html`.
* Implements safety rules: Route 960 and Free mode are explicitly excluded from challenge eligibility.

---

## 5. Security & Anti-Cheat Foundations

To preserve leaderboards fairness, CTRC HK enforces real-time speed monitoring:
* **Anti-Cheat Validation**: Any ride reporting speeds exceeding $45\text{ km/h}$ or demonstrating vehicular GPS signatures is voided (`anti_cheat` flag is flagged).
* **Validation thresholds**: Activities below $0.2\text{ km}$ are rejected to prevent idle record submission.
