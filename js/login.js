// Import the Supabase client
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = 'https://cbvsrhwimwkwtxpftjbe.supabase.co';
const supabaseAnonKey = process.env.ANON_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Login function
async function login(email, password) {
    const { user, session, error } = await supabase.auth.signIn({
        email,
        password,
    });

    if (error) {
        console.error('Login error:', error.message);
        return;
    }

    console.log('Logged in user:', user);
    console.log('Session:', session);
}

// Example usage
document.getElementById('loginButton').addEventListener('click', () => {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    login(email, password);
});
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        window.location.href = 'coming_soon.html';
    }
});


