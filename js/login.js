// /js/login.js

// --- 監聽表單提交 ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const googleLoginBtn = document.getElementById('google-login-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }
});

// --- 註冊處理 ---
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const full_name = document.getElementById('register-fullname').value;
    const phone = document.getElementById('register-phone').value;
    const experience = document.getElementById('register-experience').value;
    const preferred_area = document.getElementById('register-area').value;
    const birthdate = document.getElementById('register-birthdate').value;
    const bike_type = document.getElementById('register-biketype').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                password, 
                full_name, 
                phone, 
                experience, 
                preferred_area,
                birthdate,
                bike_type
            }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('註冊成功！您已成為高級會員。將跳轉至登入頁面。');
            window.location.href = '/login.html';
        } else {
            // 提供更友善的錯誤訊息
            let errorMessage = data.message || '註冊失敗';
            
            // 檢查是否是數據庫相關錯誤（檢查常見的資料庫錯誤關鍵字）
            const lowerErrorMsg = errorMessage.toLowerCase();
            const isDatabaseError = lowerErrorMsg.includes('relation') || 
                                   lowerErrorMsg.includes('does not exist') ||
                                   lowerErrorMsg.includes('table') ||
                                   lowerErrorMsg.includes('pattern');
            
            if (isDatabaseError) {
                errorMessage = '數據庫尚未設置，請聯絡網站管理員完成資料庫配置。';
            } else if (lowerErrorMsg.includes('password')) {
                errorMessage = '密碼必須至少 8 個字元';
            } else if (errorMessage.includes('Email already exists') || errorMessage.includes('already exists')) {
                errorMessage = '此電子郵件已被註冊，請使用其他郵件或前往登入頁面';
            }
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Register error:', error);
        alert(`註冊失敗：\n${error.message}`);
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
        // 等待 Supabase 初始化完成
        let attempts = 0;
        const maxAttempts = 50; // 最多等待 5 秒
        
        while (!window.supabase && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.supabase) {
            throw new Error('Supabase 載入失敗。\n\n可能原因：\n1. 網絡連接問題\n2. Supabase 庫未正確載入\n\n請重新整理頁面後再試。');
        }
        
        // 檢查 Supabase auth 是否存在
        if (!window.supabase.auth || !window.supabase.auth.signInWithOAuth) {
            throw new Error('Supabase 認證功能不可用。\n\n可能原因：\n1. Supabase 版本不相容\n2. 認證功能未啟用\n\n請聯絡網站管理員檢查 Supabase 配置。');
        }
        
        console.log('開始 Google 登入流程...');
        
        // 獲取當前域名用於回調
        const currentDomain = window.location.origin;
        
        // 使用 Supabase 處理 Google 登入
        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${currentDomain}/auth-callback.html`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });

        if (error) {
            console.error('Google OAuth 錯誤:', error);
            
            // 提供更友善的錯誤訊息
            let errorMessage = error.message || 'Google 登入失敗';
            
            if (errorMessage.includes('not enabled')) {
                errorMessage = 'Google 登入功能尚未啟用。\n\n請聯絡網站管理員在 Supabase 後台啟用 Google OAuth 提供商。';
            }
            
            throw new Error(errorMessage);
        }
        
        console.log('Google OAuth 重定向中...');
        
    } catch (error) {
        console.error('Google login error:', error);
        alert(`Google 登入失敗：\n${error.message}`);
    }
}

