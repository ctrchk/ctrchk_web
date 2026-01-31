# Testing Guide for Authentication System

This guide explains how to test both authentication flows in the CTRC HK website.

## Prerequisites

1. **Database Setup**: Ensure you've run the SQL schema from `database-schema.sql` on your Vercel Postgres database
2. **Environment Variables**: Make sure `JWT_SECRET` is set in your Vercel project settings
3. **Supabase Configuration**: Ensure Google OAuth is enabled in your Supabase project with the correct redirect URLs

## Testing Traditional Email/Password Registration (Senior Member Path)

### Expected Flow:
User registers → Fills complete profile → Immediately becomes Senior Member

### Steps:

1. **Navigate to Registration Page**
   - Go to `/register.html`
   - You should see a comprehensive registration form

2. **Fill Out Registration Form**
   - Email: Use a unique email (e.g., `test-senior@example.com`)
   - Password: At least 8 characters
   - Name: Full name
   - Phone: Contact number
   - Experience: Select any option
   - Preferred Area: Select any option
   - Optional fields: Birthdate, Bike Type

3. **Submit Registration**
   - Click "註冊並成為高級會員" (Register and Become Senior Member)
   - Should see: "註冊成功！您已成為高級會員。將跳轉至登入頁面。"
   - Should redirect to `/login.html`

4. **Login with New Account**
   - Email: `test-senior@example.com`
   - Password: (your password)
   - Click "登入"
   - Should see: "登入成功！"
   - Should redirect to `/dashboard.html`

5. **Verify Senior Member Status**
   - Dashboard should show: "⭐ 高級會員" (Senior Member)
   - Should NOT see the upgrade notice banner
   - User should have full access to features

### Database Verification:
```sql
SELECT email, user_role, profile_completed, auth_provider 
FROM users 
WHERE email = 'test-senior@example.com';
```
Expected result:
- `user_role`: 'senior'
- `profile_completed`: true
- `auth_provider`: 'email'

---

## Testing Google OAuth Login (Junior to Senior Member Path)

### Expected Flow:
User logs in with Google → Junior Member → Completes Profile → Upgrades to Senior Member

### Steps:

1. **Navigate to Login Page**
   - Go to `/login.html`
   - Click "使用 Google 登入" (Login with Google)

2. **Complete Google OAuth**
   - Should redirect to Google login
   - Select/login with Google account
   - Grant permissions
   - Should redirect back to `/auth-callback.html`

3. **First-Time Google User**
   - Should see: "歡迎加入 CTRC HK！請補充您的資料以升級為高級會員獲得完整功能。"
   - Should automatically redirect to `/profile-setup.html`

4. **View Junior Member Dashboard (Optional)**
   - If you navigate to `/dashboard.html` before completing profile:
   - Should see: "👤 初級會員" (Junior Member)
   - Should see yellow upgrade notice banner
   - "立即升級" button should be visible

5. **Complete Profile Setup**
   - On `/profile-setup.html`, fill out:
     - Name (required)
     - Phone (required)
     - Experience (required)
     - Preferred Area (required)
     - Optional: Birthdate, Bike Type
   - Progress bar should update as you fill fields
   - Click "完成設定，升級為高級用戶"

6. **Verify Upgrade**
   - Should see: "恭喜！您已成功升級為高級用戶！"
   - Should redirect to `/dashboard.html`
   - Dashboard should now show: "⭐ 高級會員"
   - Upgrade notice should NOT be visible

### Database Verification:
```sql
SELECT email, user_role, profile_completed, auth_provider, google_id 
FROM users 
WHERE email = 'your-google-email@gmail.com';
```
Expected result:
- `user_role`: 'senior' (after profile completion)
- `profile_completed`: true
- `auth_provider`: 'google'
- `google_id`: (should have a value)

---

## Testing Existing Google User Login

### Steps:

1. **Login Again with Same Google Account**
   - Go to `/login.html`
   - Click "使用 Google 登入"
   - Complete Google OAuth

2. **Verify Direct Access**
   - Should NOT see the welcome/profile prompt
   - Should directly redirect to `/dashboard.html`
   - Dashboard should show: "⭐ 高級會員" (since profile was completed)

---

## Common Issues and Troubleshooting

### Issue: "User not found" after Google login
**Solution**: Check if the user was created in the database. The `google-auth.js` API should create a new user on first login.

### Issue: Redirect URL mismatch
**Solution**: 
1. Ensure Supabase redirect URLs include your domain
2. Check that `supabase-config.js` uses `window.location.origin`

### Issue: Can't upgrade from junior to senior
**Solution**:
1. Check if all required fields are filled in profile-setup form
2. Verify `update-profile.js` API is accessible
3. Check browser console for errors

### Issue: JWT token errors on login
**Solution**: Ensure `JWT_SECRET` environment variable is set in Vercel

---

## Test Checklist

- [ ] Email registration creates senior member
- [ ] Email login works for registered users
- [ ] Google login creates junior member on first use
- [ ] Junior members see upgrade prompt
- [ ] Profile completion upgrades to senior
- [ ] Senior members have full dashboard access
- [ ] Existing Google users login directly to dashboard
- [ ] Database correctly stores user_role for both auth methods
- [ ] Password hashing works (passwords not stored in plain text)
- [ ] SQL injection prevented (parameterized queries used)

---

## Security Verification

After testing, verify:

1. **Check database** - No plain text passwords:
   ```sql
   SELECT password_hash FROM users WHERE auth_provider = 'email' LIMIT 1;
   ```
   Should see bcrypt hash (starts with `$2a$` or `$2b$`)

2. **Verify tokens** - JWT tokens should contain minimal info:
   - Open browser DevTools → Application → Local Storage
   - Check `accessToken` value
   - Decode at jwt.io (should only have userId, email, role)

3. **Test authorization** - Try accessing protected endpoints without token:
   - Should get 401 Unauthorized

---

## Notes

- Google OAuth requires Supabase configuration - see DATABASE-SETUP.md
- For local testing, use `http://localhost:3000` in Supabase redirect URLs
- For production, use your actual domain
- Remember to clear browser cache/cookies between tests if needed
