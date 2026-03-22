// /js/login.js

// --- 初始化 Google Identity Services ---
let googleClientId = '';

async function loadGoogleSignIn() {
    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();
        googleClientId = config.googleClientId || '';
    } catch (e) {
        console.warn('無法載入 Google Client ID:', e);
    }

    if (!googleClientId) {
        console.warn('GOOGLE_CLIENT_ID 尚未設置，Google 登入功能將無法使用。');
        const googleBtn = document.getElementById('google-login-btn-container');
        if (googleBtn) {
            googleBtn.innerHTML =
                '<p style="color:#888;font-size:0.85em;">Google 登入尚未啟用，請聯絡管理員。</p>';
        }
        return;
    }

    // 若 GIS 函式庫已載入則直接初始化，否則等待其 onload 回調
    if (typeof google !== 'undefined' && google.accounts) {
        initGoogleButton();
    } else {
        // GIS 提供 window.onGoogleLibraryLoad 作為載入完成的標準回調
        window.onGoogleLibraryLoad = initGoogleButton;
    }
}

function initGoogleButton() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services 函式庫載入失敗');
        return;
    }

    google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
    });

    const container = document.getElementById('google-login-btn-container');
    if (container) {
        google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            locale: 'zh-TW',
            width: container.offsetWidth || 300
        });
    }
}

// --- 接收 Google GIS 回調 ---
async function handleGoogleCredentialResponse(response) {
    try {
        const res = await fetch('/api/google-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (!data.user.profile_completed) {
                alert('歡迎加入城市運輸單車！\n請補充您的資料以升級為高級會員，享受完整功能。');
                window.location.href = '/profile-setup.html';
            } else {
                alert('Google 登入成功！');
                window.location.href = '/dashboard';
            }
        } else {
            alert('Google 登入失敗：' + (data.message || '未知錯誤'));
        }
    } catch (error) {
        console.error('Google 登入錯誤:', error);
        alert('Google 登入失敗：' + error.message);
    }
}

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

    // 載入 Google 登入
    loadGoogleSignIn();
});

// --- 註冊處理 ---
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const full_name = document.getElementById('register-fullname').value.trim();
    const phone = document.getElementById('register-phone')?.value.trim() || '';
    const experience = document.getElementById('register-experience')?.value || '';
    const birthdate = document.getElementById('register-birthdate')?.value || '';
    const bike_type = document.getElementById('register-biketype')?.value || '';

    // 驗證條款同意
    const termsAgreed = document.getElementById('register-terms')?.checked;
    if (!termsAgreed) {
        alert('請先閱讀並同意條款及細則、隱私條例及免責聲明，方可完成註冊。');
        return;
    }

    // 驗證密碼一致
    if (password !== confirmPassword) {
        alert('兩次輸入的密碼不一致，請重新輸入。');
        return;
    }

    // 獲取多選地區
    const areaCheckboxes = document.querySelectorAll('input[name="preferred_area"]:checked');
    const preferred_area = Array.from(areaCheckboxes).map(cb => cb.value).join(',');

    // 檢查高級會員欄位是否部分填寫
    const premiumValues = [phone, experience, preferred_area];
    const premiumFilled = premiumValues.filter(v => v.trim() !== '');
    if (premiumFilled.length > 0 && premiumFilled.length < 3) {
        alert('如需升級為高級會員，請填齊所有高級會員資料（電話、騎行經驗、騎行地區）。\n\n若暫時不升級，請清空所有高級會員欄位。');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                password, 
                full_name, 
                phone: phone || undefined, 
                experience: experience || undefined, 
                preferred_area: preferred_area || undefined,
                birthdate: birthdate || undefined,
                bike_type: bike_type || undefined
            }),
        });

        const data = await response.json();

        if (response.ok) {
            // 新用戶需要驗證電郵，不進行自動登入
            const successMsg = data.message || '註冊成功！';
            alert(successMsg + '\n\n請先查閱你的郵箱並點擊驗證連結，完成驗證後再登入。');
            window.location.href = '/verify-email?pending=1';
        } else {
            let errorMessage = data.message || '註冊失敗';
            
            // 提供更友善的錯誤訊息
            const lowerErrorMsg = errorMessage.toLowerCase();
            const isDatabaseError = lowerErrorMsg.includes('relation') || 
                                   lowerErrorMsg.includes('does not exist') ||
                                   lowerErrorMsg.includes('table') ||
                                   lowerErrorMsg.includes('pattern') ||
                                   lowerErrorMsg.includes('connect') ||
                                   lowerErrorMsg.includes('database_url') ||
                                   lowerErrorMsg.includes('connection');
            
            if (isDatabaseError) {
                errorMessage = '資料庫尚未設置，請聯絡網站管理員完成資料庫配置。';
            } else if (lowerErrorMsg.includes('password')) {
                errorMessage = '密碼必須至少 8 個字元';
            } else if (lowerErrorMsg.includes('email already exists') || lowerErrorMsg.includes('already exists')) {
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
            // 未完成電郵驗證的帳戶不允許登入
            if (data.user && data.user.email_verified === false) {
                alert('你的電子郵件尚未驗證。\n請先查閱你的郵箱，點擊驗證連結後再登入。');
                window.location.href = '/verify-email?pending=1';
                return;
            }
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            const name = data.user?.full_name || data.user?.email || '用戶';
            alert(`歡迎回來，${name}！`);
            window.location.href = '/dashboard';
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
async function fetchProtectedData(url) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        throw new Error('No token found');
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 401) {
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
