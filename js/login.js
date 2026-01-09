// /js/login.js

// --- 監聽表單提交 ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

// --- 註冊處理 ---
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('註冊成功！將跳轉至登入頁面。');
            window.location.href = '/login.html';
        } else {
            throw new Error(data.message || '註冊失敗');
        }
    } catch (error) {
        console.error('Register error:', error);
        alert(`註冊失敗: ${error.message}`);
    }
}

// --- 登入處理 ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // ** 儲存 Token 和 User data **
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            alert('登入成功！');
            // 跳轉到儀表板
            window.location.href = '/dashboard.html';
        } else {
            throw new Error(data.message || '登入失敗');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(`登入失敗: ${error.message}`);
    }
}

// --- 登出處理 ---
function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    alert('你已成功登出。');
    window.location.href = '/index.html';
}

// --- 輔助函數：檢查登入狀態 ---
function isLoggedIn() {
    return !!localStorage.getItem('accessToken');
}

// --- 輔助函數：獲取用戶資料 ---
function getUserData() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// --- 輔助函數：獲取受保護的數據 ---
// (這會被 dashboard.html 使用)
async function fetchProtectedData(url) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        // 確保在 dashboard.html 的守衛會處理這個
        throw new Error('No token found');
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 401) {
        // Token 過期或無效
        alert('你的登入已過期，請重新登入。');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data');
    }

    return response.json();
}

// Google 登入處理
async function handleGoogleLogin() {
    try {
        // 這裡我們會使用 Supabase 來處理 Google 登入
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/dashboard.html`
            }
        });

        if (error) throw error;
        
    } catch (error) {
        console.error('Google login error:', error);
        alert(`Google 登入失敗: ${error.message}`);
    }
}

// 監聽 Google 登入按鈕
document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }
});
