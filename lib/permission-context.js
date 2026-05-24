// /lib/permission-context.js
// v2.0 beta: Triple-track rank/permission context

export const RANKS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
};

export const RANK_ORDER = {
  [RANKS.BRONZE]: 1,
  [RANKS.SILVER]: 2,
  [RANKS.GOLD]: 3,
};

export const RANK_LABEL_ZH = {
  [RANKS.BRONZE]: '銅卡',
  [RANKS.SILVER]: '銀卡',
  [RANKS.GOLD]: '金卡',
};

export const PERMISSIONS = Object.freeze([
  { key: 'basic_2d_cycling_navigation', minRank: RANKS.BRONZE },
  { key: 'basic_ride_and_streak_stats', minRank: RANKS.BRONZE },
  { key: 'basic_weather', minRank: RANKS.BRONZE },
  { key: 'ig_story_poster_with_watermark', minRank: RANKS.BRONZE },
  { key: 'discord_basic_channel_access', minRank: RANKS.BRONZE },
  { key: 'basic_variable_reward_settlement', minRank: RANKS.BRONZE },
  { key: 'cycparkspace_realtime_map', minRank: RANKS.SILVER },
  { key: 'silver_shine_theme_and_avatar_frame', minRank: RANKS.SILVER },
  { key: 'multi_stop_route_planning_5_checkpoints', minRank: RANKS.SILVER },
  { key: 'priority_heavy_rain_alerts', minRank: RANKS.SILVER },
  { key: 'hd_poster_without_watermark', minRank: RANKS.SILVER },
  { key: 'mileage_coin_yield_boost_5_percent', minRank: RANKS.SILVER },
  { key: 'map_hazard_reporting', minRank: RANKS.SILVER },
  { key: 'weekly_riding_efficiency_report', minRank: RANKS.SILVER },
  { key: 'discord_silver_role_and_emotes', minRank: RANKS.SILVER },
  { key: 'mapbox_3d_lane_view_forced', minRank: RANKS.GOLD },
  { key: 'black_gold_minimal_map_skin', minRank: RANKS.GOLD },
  { key: 'poster_99_percent_superiority_copy', minRank: RANKS.GOLD },
  { key: 'mileage_coin_yield_boost_15_percent', minRank: RANKS.GOLD },
  { key: 'route_naming_submission', minRank: RANKS.GOLD },
  { key: 'five_minute_rain_radar', minRank: RANKS.GOLD },
  { key: 'beta_feature_priority_access', minRank: RANKS.GOLD },
  { key: 'discord_emergency_coordinate_ping', minRank: RANKS.GOLD },
  { key: 'weekend_x2_mileage_24h_early_unlock', minRank: RANKS.GOLD },
  { key: 'discord_gold_role_highlight_and_entrance_fx', minRank: RANKS.GOLD },
]);

function normalizeRank(rank) {
  const r = String(rank || '').toLowerCase().trim();
  if (r === RANKS.GOLD || r === '金卡') return RANKS.GOLD;
  if (r === RANKS.SILVER || r === '銀卡') return RANKS.SILVER;
  return RANKS.BRONZE;
}

export function hasPermission(rank, permissionKey) {
  const normalizedRank = normalizeRank(rank);
  const def = PERMISSIONS.find((p) => p.key === permissionKey);
  if (!def) return false;
  return RANK_ORDER[normalizedRank] >= RANK_ORDER[def.minRank];
}

export function permissionContextForRank(rank) {
  const normalizedRank = normalizeRank(rank);
  const flags = {};
  for (const p of PERMISSIONS) {
    flags[p.key] = RANK_ORDER[normalizedRank] >= RANK_ORDER[p.minRank];
  }
  return {
    rank: normalizedRank,
    rank_label_zh: RANK_LABEL_ZH[normalizedRank],
    total_permissions: PERMISSIONS.length,
    unlocked_permissions: PERMISSIONS.filter((p) => flags[p.key]).map((p) => p.key),
    locked_permissions: PERMISSIONS.filter((p) => !flags[p.key]).map((p) => p.key),
    flags,
  };
}

export function deriveMileageRank({ mileage365 = 0, previousRank = RANKS.BRONZE }) {
  const km = Number(mileage365 || 0);
  const prev = normalizeRank(previousRank);

  if (km >= 2000) return RANKS.GOLD;
  if (km >= 500) return RANKS.SILVER;
  if (prev === RANKS.GOLD && km >= 1500) return RANKS.GOLD;   // 保級
  if (prev === RANKS.SILVER && km >= 400) return RANKS.SILVER; // 保級
  return RANKS.BRONZE;
}

export function mileageCoinBoostMultiplier(rank) {
  if (hasPermission(rank, 'mileage_coin_yield_boost_15_percent')) return 1.15;
  if (hasPermission(rank, 'mileage_coin_yield_boost_5_percent')) return 1.05;
  return 1;
}
