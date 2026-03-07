// /api/email.js
// 電郵發送工具模組 - 使用 Gmail SMTP (enquiry@ctrchk.com → ctrcz9829@gmail.com)

import nodemailer from 'nodemailer';

/**
 * 建立郵件傳輸器
 */
function createTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER / SMTP_PASS 環境變數未設置');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

/**
 * 發送電郵驗證信
 * @param {string} toEmail - 收件人電郵
 * @param {string} name - 收件人姓名
 * @param {string} token - 驗證 token
 */
export async function sendVerificationEmail(toEmail, name, token) {
  const transporter = createTransporter();
  const baseUrl = process.env.BASE_URL || 'https://ctrchk.com';
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"CTRC HK" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '【CTRC HK】請驗證您的電子郵件',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2em; background: #f9f9f9;">
        <div style="background: linear-gradient(to right, #BFE340, #04D93C); padding: 1.5em; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 1.5em;">香港城市運輸單車 CTRC HK</h1>
        </div>
        <div style="background: white; padding: 2em; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50;">你好，${name || toEmail}！</h2>
          <p>感謝您註冊成為 CTRC HK 的會員。請點擊以下按鈕驗證您的電子郵件地址：</p>
          <div style="text-align: center; margin: 2em 0;">
            <a href="${verifyUrl}" 
               style="background-color: #04D93C; color: white; padding: 0.8em 2em; border-radius: 50px; text-decoration: none; font-weight: bold; display: inline-block;">
              ✅ 驗證我的電郵
            </a>
          </div>
          <p style="color: #666; font-size: 0.9em;">此連結將於 24 小時後失效。</p>
          <p style="color: #666; font-size: 0.9em;">如果您沒有註冊 CTRC HK 帳戶，請忽略此電郵。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 1.5em 0;">
          <p style="color: #999; font-size: 0.8em; text-align: center;">
            &copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
          </p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

/**
 * 發送歡迎郵件（驗證成功後）
 * @param {string} toEmail - 收件人電郵
 * @param {string} name - 收件人姓名
 */
export async function sendWelcomeEmail(toEmail, name) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"CTRC HK" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '【CTRC HK】歡迎加入！電郵驗證成功',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 2em; background: #f9f9f9;">
        <div style="background: linear-gradient(to right, #BFE340, #04D93C); padding: 1.5em; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 1.5em;">香港城市運輸單車 CTRC HK</h1>
        </div>
        <div style="background: white; padding: 2em; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50;">🎉 歡迎加入，${name || toEmail}！</h2>
          <p>您的電子郵件地址已成功驗證。您現在可以享受 CTRC HK 的完整服務！</p>
          <div style="background: #e8f5e9; padding: 1em; border-radius: 8px; margin: 1.5em 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">您可以：</h3>
            <ul style="color: #333;">
              <li>瀏覽所有單車路線</li>
              <li>查看個人騎行歷史</li>
              <li>完善資料以升級為高級會員，享受 GPX 下載功能</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 2em 0;">
            <a href="${process.env.BASE_URL || 'https://ctrchk.com'}/dashboard" 
               style="background-color: #04D93C; color: white; padding: 0.8em 2em; border-radius: 50px; text-decoration: none; font-weight: bold; display: inline-block;">
              前往我的帳戶
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 1.5em 0;">
          <p style="color: #999; font-size: 0.8em; text-align: center;">
            &copy; 2026 香港城市運輸單車 CTRC HK. All Rights Reserved.
          </p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}
