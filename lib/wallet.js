// /lib/wallet.js
import { query } from './db.js';

const WALLETWALLET_API_KEY = "ww_live_22f7b69fddac4dd40890d494fcbc4682";
const TEMPLATE_GOLD = "https://api.walletwallet.dev/p/40c18c8f-06ba-46aa-a36d-dc83279142e3";
const TEMPLATE_SILVER = "https://api.walletwallet.dev/p/b9b7b535-2f0e-486e-81d2-d0fc86b3890f";
const TEMPLATE_BRONZE = "https://api.walletwallet.dev/p/e5940b6a-c7d2-43c6-8bcd-f6bc03183b1d";

function normalizeMileageRank(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw.includes('gold') || raw.includes('金')) return 'gold';
  if (raw.includes('silver') || raw.includes('銀')) return 'silver';
  return 'bronze';
}

/**
 * Updates a user's WalletWallet membership card asynchronously in the background.
 * If the user does not have an existing pass serial number registered, this function
 * is a safe, silent no-op (avoids creating unrequested passes).
 */
export async function updateWalletPassForUser(userId) {
  try {
    // 1. Fetch latest user details and statistics
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.username,
              gp.level, gp.mileage_rank, gp.wallet_serial_number,
              COALESCE((SELECT SUM(ch.distance_km) FROM cycling_history ch WHERE ch.user_id = u.id), 0) AS total_distance_km,
              COALESCE((SELECT SUM(ch.distance_km)
                        FROM cycling_history ch
                        WHERE ch.user_id = u.id
                          AND ch.ride_date >= (CURRENT_DATE - INTERVAL '365 days')), 0) AS rolling_distance_km
       FROM users u
       LEFT JOIN user_game_profile gp ON gp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) return null;
    const user = rows[0];

    const serialNumber = user.wallet_serial_number;
    if (!serialNumber) {
      console.info(`[updateWalletPassForUser] No wallet_serial_number registered for user ${userId}. Skipping push update.`);
      return null;
    }

    const rank = normalizeMileageRank(user.mileage_rank || 'bronze');
    const mileage = Number(user.rolling_distance_km || 0);
    const name = user.full_name || user.username || '單車愛好者';

    let templateId = TEMPLATE_BRONZE;
    let colorPreset = 'orange';
    let customColor = '#D8A56B';

    if (rank === 'gold') {
      templateId = TEMPLATE_GOLD;
      colorPreset = 'orange';
      customColor = '#F0D372';
    } else if (rank === 'silver') {
      templateId = TEMPLATE_SILVER;
      colorPreset = 'dark';
      customColor = '#D1D9DF';
    }

    // Default high-resolution fallback logo
    const logoURL = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/maps/directions_bike/materialicons/48dp/2x/baseline_directions_bike_black_48dp.png';

    const passBody = {
      template: templateId,
      barcodeValue: `CTRC-USER-${user.id}`,
      barcodeFormat: 'QR',
      logoText: 'CTRC HK',
      logoURL: logoURL,
      colorPreset: colorPreset,
      color: customColor,
      primaryFields: [
        { label: 'MEMBER', value: name }
      ],
      secondaryFields: [
        { label: 'MILEAGE', value: `${mileage.toFixed(1)} km`, changeMessage: '您的近 365 天總里程已更新為 %@' },
        { label: 'RANK', value: rank === 'gold' ? 'Gold 金卡' : (rank === 'silver' ? 'Silver 銀卡' : 'Bronze 銅卡'), changeMessage: '您的會員等級已更新為 %@' }
      ],
      headerFields: [
        { label: 'LEVEL', value: `Lv.${user.level || 1}`, changeMessage: '恭喜！您的等級已提升至 %@' }
      ]
    };

    const updateResponse = await fetch(`https://api.walletwallet.dev/api/passes/${serialNumber}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WALLETWALLET_API_KEY}`
      },
      body: JSON.stringify(passBody)
    });

    if (updateResponse.status === 200) {
      const resJson = await updateResponse.json();
      console.info(`[updateWalletPassForUser] Wallet pass successfully updated & pushed for serial ${serialNumber}:`, resJson);
      return resJson;
    } else {
      console.warn(`[updateWalletPassForUser] Failed to update pass for serial ${serialNumber}. Status: ${updateResponse.status}`);
      return null;
    }
  } catch (error) {
    console.error(`[updateWalletPassForUser] Error during pass update for user ${userId}:`, error);
    return null;
  }
}
