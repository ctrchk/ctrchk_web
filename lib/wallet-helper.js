// /lib/wallet-helper.js
// Utility to trigger real-time updates and push notifications for Wallet passes via WalletWallet API.
//
import { query } from './db.js';
import { normalizeMileageRank } from './permissions.js';

const WALLETWALLET_API_KEY = "ww_live_22f7b69fddac4dd40890d494fcbc4682";
const TEMPLATE_GOLD = "https://api.walletwallet.dev/p/40c18c8f-06ba-46aa-a36d-dc83279142e3";
const TEMPLATE_SILVER = "https://api.walletwallet.dev/p/b9b7b535-2f0e-486e-81d2-d0fc86b3890f";
const TEMPLATE_BRONZE = "https://api.walletwallet.dev/p/e5940b6a-c7d2-43c6-8bcd-f6bc03183b1d";

/**
 * Triggers a real-time update and push notification to the user's Apple & Google Wallet pass.
 * @param {number|string} userId - The user ID to update.
 * @param {string} [host] - The host header to construct absolute logo URLs.
 * @param {string} [protocol] - The protocol (http/https).
 */
export async function triggerWalletPassUpdate(userId, host = '', protocol = 'https') {
  try {
    if (!userId) return;

    // Fetch latest user data and wallet_serial
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.username,
              gp.level, gp.mileage_rank, gp.wallet_serial,
              COALESCE((SELECT SUM(ch.distance_km)
                        FROM cycling_history ch
                        WHERE ch.user_id = u.id
                          AND ch.ride_date >= (CURRENT_DATE - INTERVAL '365 days')), 0) AS rolling_distance_km
       FROM users u
       LEFT JOIN user_game_profile gp ON gp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      console.info(`[WalletUpdate] User ${userId} not found.`);
      return;
    }

    const user = rows[0];
    const walletSerial = user.wallet_serial;
    if (!walletSerial) {
      // User hasn't added or generated a wallet pass yet
      console.info(`[WalletUpdate] User ${userId} does not have a saved wallet_serial.`);
      return;
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

    let logoURL = undefined;
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('sandbox') || !host) {
      // Public fallback so developers can test locally without fetch errors
      logoURL = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/maps/directions_bike/materialicons/48dp/2x/baseline_directions_bike_black_48dp.png';
    } else {
      logoURL = `${protocol}://${host}/images/logo.png`;
    }

    console.info(`[WalletUpdate] Sending PUT to WalletWallet for serial ${walletSerial}...`);

    // Call WalletWallet PUT API to update the pass and trigger real-time push
    const response = await fetch(`https://api.walletwallet.dev/api/passes/${walletSerial}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WALLETWALLET_API_KEY}`
      },
      body: JSON.stringify({
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
          { label: 'MILEAGE', value: `${mileage.toFixed(1)} km` },
          { label: 'RANK', value: rank === 'gold' ? 'Gold 金卡' : (rank === 'silver' ? 'Silver 銀卡' : 'Bronze 銅卡') }
        ],
        headerFields: [
          { label: 'LEVEL', value: `Lv.${user.level || 1}` }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[WalletUpdate] WalletWallet PUT error for ${walletSerial}:`, errText);
    } else {
      console.info(`[WalletUpdate] Successfully updated and pushed Wallet pass for user ${userId} / ${walletSerial}`);
    }
  } catch (err) {
    console.error(`[WalletUpdate] Exception triggering Wallet update for user ${userId}:`, err.message);
  }
}
