# JWT 認證故障排除指南 (JWT Authentication Guide)

如果您在加入房間或查看徽章時遇到「Invalid or expired token: jwt expired」錯誤，這代表您的登入會話已過期。

## 使用者解決方案 (For Users)
1. **重新登入**：登出目前的帳號並重新登入。這將重新產生一個有效的權杖 (Token)。
2. **清除瀏覽器快取**：如果重新登入無效，請嘗試清除瀏覽器的本機儲存空間 (LocalStorage) 或快取。

## 開發者/管理員解決方案 (For Developers/Admins)
如果您希望延長登入狀態的有效時間，請檢查後端環境變數：

1. **JWT_SECRET**：確保所有 API 使用相同的祕鑰。
2. **權杖有效期**：在產生存權杖的地方（通常是 `api/login.js` 或 `api/auth-google.js`），您可以調整 `expiresIn` 參數。
   - 例如：`jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })` 將有效期設為 7 天。

## 系統自動處理
我們已在 `routes.html` 和 `ride.html` 中加入了偵測機制。一旦發現權杖過期，系統會自動引導您回到登入頁面，以確保功能正常運作。
