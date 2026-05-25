// /lib/permissions.js
// Permission context for mileage rank entitlements (Bronze/Silver/Gold).

export const MILEAGE_RANKS = ['bronze', 'silver', 'gold'];

export const MILEAGE_RANK_LABELS = {
  bronze: '銅卡',
  silver: '銀卡',
  gold: '金卡',
};

export const PERMISSION_DEFS = [
  { id: 1, key: 'nav_2d_basic', rank: 'bronze', label: '基礎 2D 單車徑導航' },
  { id: 2, key: 'ride_basic_stats', rank: 'bronze', label: '基礎個人騎行與連勝數據紀錄' },
  { id: 3, key: 'weather_basic', rank: 'bronze', label: '基礎氣象資訊（氣溫、濕度）' },
  { id: 4, key: 'poster_basic', rank: 'bronze', label: 'IG Story 數據海報（含 CTRCHK 浮水印）' },
  { id: 5, key: 'discord_basic', rank: 'bronze', label: 'Discord 基礎頻道訪問權' },
  { id: 6, key: 'reward_variable', rank: 'bronze', label: '基礎隨機多巴胺盲盒結算' },
  { id: 7, key: 'map_cycparkspace', rank: 'silver', label: 'CYCPARKSPACE 全港單車泊位圖層' },
  { id: 8, key: 'theme_silver', rank: 'silver', label: '銀色閃耀 UI 主題與動態頭像框' },
  { id: 9, key: 'nav_multistop', rank: 'silver', label: '多站點自訂路線規劃（最多 5 站）' },
  { id: 10, key: 'weather_heavy_rain_alert', rank: 'silver', label: '突發暴雨預警優先推送' },
  { id: 11, key: 'poster_no_watermark', rank: 'silver', label: '無浮水印高清數據海報' },
  { id: 12, key: 'coin_bonus_silver', rank: 'silver', label: '里程幣收益永久加成 +5%' },
  { id: 13, key: 'map_issue_report', rank: 'silver', label: '路面維修/障礙標記權' },
  { id: 14, key: 'weekly_efficiency_report', rank: 'silver', label: '週度騎行效率深度分析' },
  { id: 15, key: 'discord_silver_role', rank: 'silver', label: 'Discord「銀色破風手」身分組' },
  { id: 16, key: 'map_3d_gold', rank: 'gold', label: 'Mapbox 3D 高精度車道視角' },
  { id: 17, key: 'theme_gold', rank: 'gold', label: '極簡黑金版地圖皮膚' },
  { id: 18, key: 'poster_gold_copy', rank: 'gold', label: '海報黃金優越感文案' },
  { id: 19, key: 'coin_bonus_gold', rank: 'gold', label: '里程幣收益永久加成 +15%' },
  { id: 20, key: 'route_naming_rights', rank: 'gold', label: '路線命名權（提交審核）' },
  { id: 21, key: 'weather_radar_5min', rank: 'gold', label: '5 分鐘級降雨雷達圖層' },
  { id: 22, key: 'beta_priority', rank: 'gold', label: '新功能 Beta 優先體驗' },
  { id: 23, key: 'discord_emergency', rank: 'gold', label: 'Discord 金卡應急小組一鍵求援' },
  { id: 24, key: 'weekend_double_preview', rank: 'gold', label: '週末 x2.0 雙倍里程路線提前 24 小時解鎖' },
  { id: 25, key: 'discord_gold_role', rank: 'gold', label: 'Discord「黃金領騎」稱號與進場特效' },
];

export function normalizeMileageRank(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw.includes('gold') || raw.includes('金')) return 'gold';
  if (raw.includes('silver') || raw.includes('銀')) return 'silver';
  if (raw.includes('bronze') || raw.includes('銅')) return 'bronze';
  return 'bronze';
}

export function buildPermissionContext(rankInput) {
  const rank = normalizeMileageRank(rankInput);
  const rankIndex = MILEAGE_RANKS.indexOf(rank);
  const permissions = {};
  const list = PERMISSION_DEFS.map((def) => {
    const requiredIndex = MILEAGE_RANKS.indexOf(def.rank);
    const enabled = rankIndex >= requiredIndex;
    permissions[def.key] = enabled;
    return { ...def, enabled };
  });
  return {
    rank,
    rank_label: MILEAGE_RANK_LABELS[rank] || '銅卡',
    permissions,
    list,
  };
}
