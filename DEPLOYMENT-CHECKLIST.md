# Deployment Checklist

Quick reference for deploying the authentication system.

## Pre-Deployment

- [ ] Review all changes in this PR
- [ ] Ensure you have access to:
  - Vercel Dashboard
  - Supabase Dashboard
  - Vercel Postgres Database

## Database Setup

- [ ] Login to Vercel Dashboard
- [ ] Navigate to your project → Storage → Postgres
- [ ] Click on "Query" tab
- [ ] Copy content from `database-schema.sql`
- [ ] Execute the SQL script
- [ ] Verify tables are created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public';
  ```

## Supabase Configuration

- [ ] Login to Supabase Dashboard
- [ ] Go to your project (https://umpxhvqcldmrmkuipmao.supabase.co)
- [ ] Navigate to Authentication → Providers
- [ ] Enable Google provider
- [ ] Configure Google OAuth credentials (if not already done)
- [ ] Add authorized redirect URLs:
  - [ ] `https://your-production-domain.vercel.app/auth-callback.html`
  - [ ] `http://localhost:3000/auth-callback.html` (for local testing)
- [ ] Save configuration

## Environment Variables

- [ ] Open Vercel project settings
- [ ] Navigate to Settings → Environment Variables
- [ ] Add/verify these variables:
  - [ ] `JWT_SECRET` (generate a secure random string)
  - [ ] `POSTGRES_URL` (auto-configured by Vercel)
  - [ ] `POSTGRES_PRISMA_URL` (auto-configured by Vercel)
  - [ ] `POSTGRES_URL_NON_POOLING` (auto-configured by Vercel)

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Code Deployment

- [ ] Merge this PR to main branch
- [ ] Vercel will auto-deploy
- [ ] Wait for deployment to complete
- [ ] Check deployment logs for errors

## Post-Deployment Verification

### 1. Check API Endpoints

Visit these URLs (replace `your-domain` with your actual domain):

- [ ] `https://your-domain.vercel.app/api/register` → Should return 405 (Method Not Allowed) for GET
- [ ] `https://your-domain.vercel.app/api/login` → Should return 405 (Method Not Allowed) for GET
- [ ] `https://your-domain.vercel.app/api/google-auth` → Should return 405 (Method Not Allowed) for GET

If you see 500 errors, check Vercel logs.

### 2. Test Pages Load

- [ ] `https://your-domain.vercel.app/register.html` loads correctly
- [ ] `https://your-domain.vercel.app/login.html` loads correctly
- [ ] `https://your-domain.vercel.app/profile-setup.html` loads correctly
- [ ] `https://your-domain.vercel.app/dashboard.html` redirects to login (since not logged in)

### 3. Test Email Registration

Follow steps in TESTING-GUIDE.md:

- [ ] Register with email/password
- [ ] Verify user created as senior member in database
- [ ] Login with registered account
- [ ] Check dashboard shows "高級會員"

### 4. Test Google Login

Follow steps in TESTING-GUIDE.md:

- [ ] Login with Google
- [ ] Verify user created as junior member
- [ ] Redirected to profile-setup page
- [ ] Complete profile
- [ ] Verify upgrade to senior member
- [ ] Login again → direct to dashboard

### 5. Database Verification

Check data in Vercel Postgres:

```sql
-- View all users
SELECT id, email, user_role, profile_completed, auth_provider, created_at 
FROM users 
ORDER BY created_at DESC;

-- Count by role
SELECT user_role, COUNT(*) 
FROM users 
GROUP BY user_role;

-- Check for any issues
SELECT * FROM users 
WHERE user_role IS NULL OR email IS NULL;
```

## Common Issues

### Issue: 500 errors on API endpoints
**Check**:
- [ ] Vercel function logs
- [ ] Database connection
- [ ] Environment variables are set

### Issue: Google login redirect fails
**Check**:
- [ ] Supabase redirect URLs include production domain
- [ ] No typos in URLs
- [ ] URLs use HTTPS (not HTTP)

### Issue: Can't create users in database
**Check**:
- [ ] Database schema is properly created
- [ ] Required columns exist
- [ ] Database permissions are correct

### Issue: JWT errors
**Check**:
- [ ] JWT_SECRET is set in Vercel
- [ ] JWT_SECRET is at least 32 characters
- [ ] Redeploy after adding JWT_SECRET

## Rollback Plan

If something goes wrong:

1. **Quick Fix**: Revert the merge commit
2. **Database**: Schema is additive, safe to keep
3. **Users**: Existing auth still works with old system
4. **Data**: No data loss, only new columns added

## Support Resources

- Vercel Logs: Project → Deployments → [Latest] → Logs
- Database Query: Project → Storage → Postgres → Query
- Supabase Logs: Project → Logs → Auth Logs
- Testing Guide: `TESTING-GUIDE.md`
- Implementation Summary: `實施總結.md`
- Database Setup: `DATABASE-SETUP.md`

## Success Criteria

✅ All checklist items completed
✅ Email registration works → Senior member
✅ Google login works → Junior member → Upgrade to Senior
✅ Dashboard shows correct membership tier
✅ No errors in Vercel logs
✅ Database contains test users with correct roles

---

**Last Updated**: 2025-01-31
**Version**: 1.0
