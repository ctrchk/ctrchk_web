// /api/config.js
// 回傳前端需要的公開設定（不含敏感資訊）
// Google Client ID 是公開資訊，可安全地暴露給前端
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 限制只允許同網域的請求（防止未授權的跨域呼叫）
  res.setHeader('Cache-Control', 'public, max-age=3600');

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
}
