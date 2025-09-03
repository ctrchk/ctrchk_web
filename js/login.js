// Import the Supabase client
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = 'https://cbvsrhwimwkwtxpftjbe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidnNyaHdpbXdrd3R4cGZ0amJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzAwNjIsImV4cCI6MjA3MjM0NjA2Mn0.idkNESZ-pJG0V74WCYXT4FudqPYD7XlPM5yEBGt4YlY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Login function
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Login error:', error.message);
        // Optionally update the UI here
        return;
    }

    console.log('Logged in user:', data.user);
    console.log('Session:', data.session);
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
    } else {
        console.log("No such credentials found");
    }
});