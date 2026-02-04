# Database Setup Instructions

This document provides instructions for setting up the database for the CTRC HK authentication system.

## Database Schema

The system uses **Vercel Postgres** as the primary database for user data and **Supabase** for Google OAuth authentication.

### Setting Up the Database

1. **Run the schema script** on your Vercel Postgres database:
   - Navigate to your Vercel project dashboard
   - Go to the Storage tab and select your Postgres database
   - Click on the "Query" tab
   - Copy and paste the contents of `database-schema.sql`
   - Click "Run Query" to execute the schema

   Alternatively, you can run it using the Vercel CLI:
   ```bash
   vercel env pull .env.local
   # Then use a PostgreSQL client with the credentials from .env.local
   ```

2. **Configure Supabase for Google OAuth**:
   - Go to your Supabase project dashboard (https://umpxhvqcldmrmkuipmao.supabase.co)
   - Navigate to Authentication > Providers
   - Enable Google OAuth provider
   - Add your authorized redirect URLs:
     - `https://your-domain.vercel.app/auth-callback.html`
     - `http://localhost:3000/auth-callback.html` (for local testing)
   - Save the configuration

3. **Set Environment Variables**:
   Make sure these environment variables are set in your Vercel project:
   - `JWT_SECRET` - A secure random string for JWT token signing
   - `POSTGRES_URL` - Automatically set by Vercel when you create a Postgres database

## Database Tables

### `users` Table
The main table for storing user information:

- `id` (SERIAL PRIMARY KEY) - Unique user identifier
- `email` (VARCHAR) - User email address (unique)
- `password_hash` (VARCHAR) - Hashed password (NULL for Google OAuth users)
- `user_role` (VARCHAR) - Membership tier: 'junior' or 'senior'
- `full_name` (VARCHAR) - User's full name
- `phone` (VARCHAR) - Contact phone number
- `birthdate` (DATE) - Date of birth (optional)
- `experience` (VARCHAR) - Cycling experience level
- `bike_type` (VARCHAR) - Type of bicycle used
- `preferred_area` (VARCHAR) - Preferred cycling area
- `profile_completed` (BOOLEAN) - Whether profile is complete
- `profile_completion_date` (TIMESTAMP) - When profile was completed
- `created_at` (TIMESTAMP) - Account creation date
- `auth_provider` (VARCHAR) - Authentication method: 'email' or 'google'
- `google_id` (VARCHAR) - Google user ID (for OAuth users)

### `cycling_history` Table
Stores user cycling history:

- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER) - Foreign key to users table
- `ride_date` (DATE) - Date of the ride
- `distance_km` (DECIMAL) - Distance in kilometers
- `route_name` (VARCHAR) - Name of the route
- `created_at` (TIMESTAMP) - Record creation date

## Authentication Flow

### Email/Password Registration (Senior Members)
1. User fills out registration form with complete profile data
2. System creates user with `user_role = 'senior'`
3. User can immediately access all features

### Google OAuth Registration (Junior Members)
1. User clicks "Google Login" button
2. After successful OAuth, system creates user with `user_role = 'junior'`
3. User is redirected to profile setup page
4. Upon completing profile, user is upgraded to `user_role = 'senior'`

## Membership Tiers

- **Junior Members** (初級會員):
  - Google OAuth users who haven't completed their profile
  - Limited access to features
  - Can upgrade by completing profile information

- **Senior Members** (高級會員):
  - Email/password registered users (automatic)
  - Google OAuth users who completed their profile
  - Full access to all features including:
    - Detailed route information
    - GPX file downloads
    - Personal cycling history
    - Community participation

## Security Notes

1. All passwords are hashed using bcrypt before storage
2. JWT tokens are used for session management
3. OAuth tokens are managed by Supabase
4. Make sure to keep your `JWT_SECRET` secure and never commit it to version control
