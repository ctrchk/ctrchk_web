// /js/main.js (完整修改版)

console.log('--- main.js 檔案已成功載入並開始執行！ ---');

/**
 * @file main.js
 * @description 網站全域腳本。【最終修正與結構優化版】
 */

// =========================================================================
// 主題 (深色/淺色) 初始化
// =========================================================================
(function initAppTheme() {
    const stored = localStorage.getItem('appTheme'); // 'dark' | 'light' | null
    if (stored === 'dark') {
        document.body.classList.add('app-theme-explicit');
        document.body.classList.remove('app-light-theme');
    } else if (stored === 'light') {
        document.body.classList.add('app-theme-explicit', 'app-light-theme');
    } else {
        // No explicit preference — let CSS @media prefers-color-scheme decide
        document.body.classList.remove('app-theme-explicit', 'app-light-theme');
    }
})();

/**
 * 切換主題並儲存設定
 * @param {'dark'|'light'|'auto'} theme
 */
function setAppTheme(theme) {
    localStorage.setItem('appTheme', theme);
    if (theme === 'light') {
        document.body.classList.add('app-theme-explicit', 'app-light-theme');
    } else if (theme === 'dark') {
        document.body.classList.add('app-theme-explicit');
        document.body.classList.remove('app-light-theme');
    } else {
        document.body.classList.remove('app-theme-explicit', 'app-light-theme');
    }
}

// =========================================================================
// 語言偏好持久化
// =========================================================================
(function applyLangPreference() {
    const lang = localStorage.getItem('appLang'); // 'en' | 'zh' | null
    if (!lang) return;
    const path = window.location.pathname;
    const isEnPage = path.startsWith('/en/') || path === '/en';

    // App-only pages that exist only in one version and support both languages.
    // Do NOT redirect these between Chinese/English — they are language-neutral.
    const appOnlyPages = ['/tasks', '/nav', '/dashboard', '/profile', '/leaderboard',
                          '/ride', '/routes', '/login', '/register', '/forgot-password',
                          '/reset-password', '/profile-setup', '/verify-email',
                          '/auth-callback', '/admin', '/weather', '/chat', '/forum',
                          '/route_detail', '/gpx', '/sw.js'];
    const isAppOnlyPage = appOnlyPages.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
    if (isAppOnlyPage) return;

    if (lang === 'en' && !isEnPage) {
        // Map to English equivalent
        const enPath = (path === '/') ? '/en/index' : '/en' + path;
        const enUrl = enPath + window.location.search;
        // Only redirect if the English page is likely to exist
        const enPages = ['/en/index','/en/about','/en/blog','/en/contact',
                         '/en/membership','/en/routes','/en/route_detail'];
        if (enPages.some(p => enUrl.startsWith(p))) {
            window.location.replace(enUrl);
        }
    } else if (lang === 'zh' && isEnPage) {
        // Map back to Chinese equivalent
        const stripped = path.replace(/^\/en(\/|$)/, '/');
        const zhPath = (stripped === '/index') ? '/' : stripped;
        window.location.replace(zhPath + window.location.search);
    }
})();

// =========================================================================
// 登入/登出 UI 處理 (新加入的程式碼)
// =========================================================================

/**
 * 檢查本地儲存中是否有 token
 * @returns {boolean}
 */
function isLoggedIn() {
    return !!localStorage.getItem('accessToken');
}

/**
 * 處理登出
 */
function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    alert('你已成功登出。');
    window.location.href = '/';
}

/**
 * 根據登入狀態更新導覽列 (Header)
 */
function updateNavUI() {
    // 這些 ID 來自 header.html
    const loginBtn = document.getElementById('nav-login-btn');
    const dashboardBtn = document.getElementById('nav-dashboard-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');

    // 確保按鈕都存在
    if (!loginBtn || !dashboardBtn || !logoutBtn) {
        console.warn('導覽列按鈕未找到，無法更新 UI 狀態');
        return;
    }
    
    if (isLoggedIn()) {
        // 已登入：顯示儀表板和登出，隱藏登入
        loginBtn.style.display = 'none';
        dashboardBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';
        
        // 顯示歡迎用戶名
        const navWelcome = document.getElementById('nav-welcome-name');
        if (navWelcome) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    const name = user.full_name || user.email || '';
                    navWelcome.textContent = name ? `👤 ${name}` : '';
                    navWelcome.style.display = name ? 'inline' : 'none';
                } catch (e) {
                    navWelcome.style.display = 'none';
                }
            }
        }
        
        // 幫登出按鈕綁定點擊事件
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    } else {
        // 未登入：顯示登入，隱藏儀表板和登出
        loginBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        const navWelcome = document.getElementById('nav-welcome-name');
        if (navWelcome) navWelcome.style.display = 'none';
    }
}


// =========================================================================
// DOMContentLoaded 主程式
// =========================================================================

document.addEventListener('DOMContentLoaded', function() {
    // ------------------- 所有程式碼都從這裡開始 -------------------

    // Reset body style on load
    document.body.style.opacity = '1';
    document.body.style.visibility = 'visible';

    // =========================================================================
    // 全站共用資料 (你原有的程式碼)
    // =========================================================================
    const routes = [
        { id: '900', alias: "市區海濱線", start: "寶琳(新都城二期)", end: "調景嶺彩明", via: "景林邨、香港單車館、將軍澳海濱、調景嶺站", nature: "旅遊", time: 40, length: "5.5km", difficulty: 3, image: "images/900.jpg", description: "這是專為新手打造的「海濱專線」。全程半個多小時，少坡、風景優美，讓你在寶琳與調景嶺之間輕鬆穿梭，沿途還有補給點可供休息。", tags: ["將軍澳", "海濱專線", "寶琳調景嶺線", "新手必試", "風景優美", "少坡"], color: "#990000", gpx: [{ label: "往寶琳", file: "900寶琳.gpx" }, { label: "往調景嶺", file: "900調景嶺.gpx" }] },
        { id: '900A', alias: "寶調特快", start: "寶琳(新都城二期)", end: "調景嶺總站", via: "景林邨、寶順路、調景嶺站", nature: "混合", time: 20, length: "4.2km", difficulty: 1.5, image: "images/900A.jpg", description: "一條專為單車新手設計的輕鬆路線。取道寶順路專用單車徑來往寶琳與調景嶺，路況平坦，僅需 20 分鐘即可往返，是假日體驗單車樂的最佳選擇。", tags: ["將軍澳", "寶琳調景嶺線", "新手必試", "特快", "平坦", "通勤", "旅遊"], color: "#990000", gpx: [{ label: "往寶琳", file: "900A寶琳.gpx" }, { label: "往調景嶺", file: "900A調景嶺.gpx" }] },
        { id: '900S', alias: "特快海濱線", start: "調景嶺總站", end: "寶琳消防局", via: "將軍澳海濱、寶琳北路", nature: "旅遊", time: 40, length: "5.0km", difficulty: 3.5, image: "images/900S.jpg", description: "適合黃昏時分騎行的單向快速路線。從將軍澳海濱直達寶琳東，全程可欣賞日落美景，僅需 40 分鐘即可完成。", tags: ["將軍澳", "單向線", "寶琳調景嶺線", "黃昏日落", "快速", "少坡", "風景優美"], color: "#990000", gpx: [{ label: "往寶琳", file: "900S寶琳.gpx" }] },
        { id: '901P', alias: "寶琳北快線", start: "寶琳(將軍澳村)", end: "將軍澳中心", via: "寶康路、將軍澳海濱、調景嶺站", nature: "混合", time: 40, length: "5.6km", difficulty: 3.5, image: "images/901P.jpg", description: "一條連接寶琳北、寶琳西與將軍澳市中心及調景嶺的特快路線。適合通勤與旅遊，讓你在城市間快速穿梭。", tags: ["將軍澳", "快速", "寶琳調景嶺線", "平坦", "通勤", "旅遊"], color: "#e06666", gpx: [{ label: "往寶琳", file: "901P寶琳.gpx" }, { label: "往調景嶺", file: "901P調景嶺.gpx" }] },
        { id: '910', alias: "坑口循環線", start: "坑口站", end: "坑口北、煜明苑", via: "坑口北、煜明苑", nature: "混合", time: 15, length: "3.1km", difficulty: 2, image: "images/910.jpg", description: "繞行坑口站及周邊外圍的雙循環線，適合通勤及旅遊。路線接駁地鐵站及巴士總站，人流較少且少坡，是進行單車訓練的理想選擇。", tags: ["將軍澳", "循環線", "坑口北專線", "少坡", "運動訓練", "連接地鐵站", "連接巴士總站", "人流較少", "通勤", "旅遊"], color: "#3c78d8", gpx: [{ label: "順時針", file: "910順時針.gpx" }, { label: "逆時針", file: "910逆時針.gpx" }] },
        { id: '914', alias: "景林快線", start: "寶琳(景林單車駅)", end: "坑口站", via: "", nature: "通勤", time: 4, length: "0.8km", difficulty: 0.5, image: "images/914.jpg", description: "專為通勤而設的景林專線。全日連接坑口站與景林邨，路況平坦且交通接駁便利，全程僅需 4 分鐘，是節省通勤時間的首選。", tags: ["將軍澳", "通勤專線", "平坦", "連接地鐵站", "連接巴士總站", "少坡"], color: "#073763", gpx: [{ label: "往寶琳", file: "914寶琳.gpx" }, { label: "往坑口", file: "914坑口.gpx" }] },
        { id: '914B', alias: "寶坑特別線", start: "寶琳(新都城二期)", end: "坑口", via: "景林邨、坑口站、厚德邨", nature: "旅遊", time: 12, length: "3.0km", difficulty: 2, image: "images/914B.jpg", description: "一條連接寶琳新都城、坑口站與坑口的旅遊路線。路況平坦，沿途接駁地鐵與巴士總站，提供便捷的坑口專線服務。", tags: ["將軍澳", "坑口北專線", "平坦", "連接地鐵站", "連接巴士總站", "少坡"], color: "#073763", gpx: [{ label: "往寶琳", file: "914B寶琳.gpx" }, { label: "往坑口", file: "914B醫院.gpx" }] },
        { id: '914H', alias: "醫院特快", start: "坑口站", end: "將軍澳醫院", via: "", nature: "混合", time: 6, length: "1.0km", difficulty: 1, image: "images/914H.jpg", description: "全日特快連接坑口站與將軍澳醫院的通勤與旅遊混合路線。路況平坦、人流較少，為你提供一條快速又寧靜的醫院專線。", tags: ["將軍澳", "坑口北專線", "醫院專線", "連接地鐵站", "少坡", "人流較少", "通勤", "旅遊"], color: "#073763", gpx: [{ label: "往坑口", file: "914H坑口.gpx" }, { label: "往醫院", file: "914H醫院.gpx" }] },
        { id: '920', alias: "尚德專線", start: "維景灣畔", end: "寶琳站", via: "調景嶺學校區、將軍澳中心、尚德、坑口站、寶琳學校區", nature: "旅遊", time: 30, length: "4.6km", difficulty: 3, image: "images/920.jpg", description: "深入將軍澳各核心區的旅遊路線。同時途經調景嶺、坑口及寶琳站，讓你盡情探索將軍澳。", tags: ["將軍澳", "旅遊專線", "少坡", "維景灣畔專線", "連接地鐵站", "學校線"], color: "#660000", gpx: [{ label: "往寶琳", file: "920寶琳.gpx" }, { label: "往調景嶺", file: "920調景嶺.gpx" }] },
        { id: '920X', alias: "維景特快", start: "維景灣畔", end: "寶琳站", via: "彩明苑", nature: "混合", time: 20, length: "3.5km", difficulty: 2.5, image: "images/920X.jpg", description: "一條從維景灣畔及彩明直達寶琳站的特快路線。相比 920，此路線無需繞經將軍澳各區，路況平坦，適合通勤及單車訓練。", tags: ["將軍澳", "平坦", "特快", "運動訓練", "新手必試", "維景灣畔專線", "連接地鐵站", "通勤", "旅遊"], color: "#660000", gpx: [{ label: "往寶琳", file: "920X寶琳.gpx" }, { label: "往調景嶺", file: "920X調景嶺.gpx" }] },
        { id: '923', alias: "市中心循環線", start: "調景嶺總站", end: null, via: "單車館公園、調景嶺碼頭、將軍澳海濱、天晉、入境事務大樓", nature: "混合", time: 40, length: "5.6km", difficulty: 3.5, image: "images/923.jpg", description: "連接調景嶺、尚德、單車館及將軍澳市中心的平坦循環線。交通接駁便利，適合通勤與休閒的混合用途。", tags: ["將軍澳", "循環", "平坦", "連接地鐵站", "通勤", "旅遊"], color: "#ff0000", gpx: [{ label: "順時針", file: "923順時針.gpx" }, { label: "逆時針", file: "923逆時針.gpx" }] },
        { id: '928', alias: "海濱特快", start: "寶琳站", end: "將軍澳(雍明)", via: "靈實、調景嶺、將軍澳海濱", nature: "混合", time: "40(往將軍澳)/30(往寶琳)", length: "6.0km(往將軍澳)/4.8km(往寶琳)", difficulty: 3.5, image: "images/928.jpg", description: "專為新手打造的海濱特快路線。全程少坡、風景優美，連接寶琳市中心、調景嶺及將軍澳海濱，沿途可連接渡輪，體驗多樣交通樂趣。", tags: ["將軍澳", "寶琳調景嶺線", "新手必試", "少坡", "海濱專線", "特快", "風景優美", "連接地鐵站", "接駁渡輪", "通勤", "旅遊"], color: "#783f04", gpx: [{ label: "往寶琳", file: "928寶琳.gpx" }, { label: "往將軍澳", file: "928將軍澳.gpx" }] },
        { id: '929', alias: "坑口快速", start: "坑口站", end: "調景嶺總站", via: "坑口北、將軍澳海濱、將軍澳站、調景嶺站", nature: "混合", time: 35, length: "6.2km", difficulty: 3, image: "images/929.jpg", description: "坑口北專線，路況平坦，連接坑口各區、將軍澳市中心及調景嶺。這條多用途路線非常適合單車新手體驗。", tags: ["將軍澳", "新手必試", "平坦", "坑口北專線", "快速", "接駁渡輪", "通勤", "旅遊"], color: "#f1c232", gpx: [{ label: "往坑口", file: "929坑口.gpx" }, { label: "往調景嶺", file: "929調景嶺.gpx" }] },
        { id: '932', alias: "坑康線", start: "坑口站", end: "將軍澳創新園", via: "坑口北、北橋、清水灣半島、康城海濱、日出康城", nature: "混合", time: 45, length: "8.1km", difficulty: 4, image: "images/932.jpg", description: "連接坑口、清水灣半島、康城及創新園的長途特快路線。路況少坡，沿著海濱騎行，是挑戰長途的絕佳選擇。", tags: ["將軍澳", "長途", "少坡", "清水灣半島專線", "海濱專線", "風景優美", "坑口北專線", "快速", "創新園路線", "通勤", "旅遊"], color: "#ff00ff", gpx: [{ label: "往創新園", file: "932創新園.gpx" }, { label: "往坑口", file: "932坑口.gpx" }] },
        { id: '935', alias: "南北專線", start: "寶琳(將軍澳村)", end: "將軍澳創新園", via: "寶康路、北橋、康城海濱、日出康城", nature: "旅遊", time: 50, length: "9.6km", difficulty: 4.5, image: "images/935.jpg", description: "一條適合旅遊與運動訓練的長途路線。由單車徑最南端的創新園出發，沿著康城海濱及寶康路一路向北，途經將軍澳北，前往單車徑最北端的將軍澳村，享受開闊的騎行體驗。", tags: ["將軍澳", "旅遊專線", "長途", "海濱專線", "運動訓練", "南北三寶", "創新園路線"], color: "#38761d", gpx: [{ label: "往寶琳", file: "935寶琳.gpx" }, { label: "往創新園", file: "935創新園.gpx" }] },
        { id: 'X935', alias: "南北特快", start: "寶琳(將軍澳村)", end: "將軍澳創新園", via: "寶琳北路、日出康城", nature: "旅遊", time: 40, length: "8.0km", difficulty: 4, image: "images/X935.jpg", description: "935的特快版本，無需跟從主線的迂迴走線，而是更加直接。此路線為長途旅遊線，路況優越，讓你能在更短時間内穿梭將軍澳南北。", tags: ["將軍澳", "旅遊專線", "特快", "長途", "海濱專線", "創新園路線", "南北三寶"], color: "#38761d", gpx: [{ label: "往宝琳", file: "X935寶琳.gpx" }, { label: "往創新園", file: "X935創新園.gpx" }] },
        { id: '939', alias: "創新園專線", start: "峻瀅", end: "將軍澳創新園", via: "環保大道", nature: "旅遊", time: 30, length: "2.5km(單向)", difficulty: 3.5, image: "images/939.jpg", description: "一條連接峻瀅及將軍澳創新園的路線。非常適合單車新手體驗，享受周邊的休閒時光，人流極少。", tags: ["將軍澳", "旅遊專線", "平坦", "新手必試", "創新園路線", "人流較少", "循環"], color: "#741b47", gpx: [{ label: "來回", file: "939循環.gpx" }] },
        { id: '939M', alias: "迷你坑口環", start: "康城站", end: "將軍澳創新園", via: "環保大道", nature: "通勤", time: 35, length: "2.9km(單向)", difficulty: 3.5, image: "images/939M.jpg", description: "連接康城站及創新園的特快通勤路線。路面平坦，專為通勤族設計，讓你可以由創新園快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "平坦", "快速", "創新園路線", "連接地鐵站", "人流較少", "循環"], color: "#741b47", gpx: [{ label: "往康城", file: "939M康城.gpx" }, { label: "往創新園", file: "939M循環.gpx" }] },
        { id: '955', alias: "寶琳循環線", start: "寶琳(新都城二期)", end: null, via: "寶順路、寶康路、寶琳北路", nature: "普通", time: 20, length: "4.1km", difficulty: 2, image: "images/955.jpg", description: "連接新都城二期（寶琳站）及寶琳各區的循環線。同時適合通勤與旅遊，及方便接駁其他交通。", tags: ["將軍澳", "平坦", "循環", "連接地鐵站", "連接巴士總站"], color: "#dd7e6b", gpx: [{ label: "順時針", file: "955順時針.gpx" }, { label: "逆時針", file: "955逆時針.gpx" }] },
        { id: '955A', alias: "將軍澳村專線", start: "將軍澳村", end: "新都城二期", via: "寶琳北路", nature: "通勤", time: 6, length: "1.2km", difficulty: 1, image: "images/955A.jpg", description: "一條從將軍澳村直達新都城二期（寶琳站）的特快通勤路線。路況少坡，交通接駁便利，全程僅需 6 分鐘。", tags: ["將軍澳", "通勤專線", "快速", "少坡", "連接地鐵站"], color: "#dd7e6b", gpx: [{ label: "單向", file: "955A將軍澳村.gpx" }] },
        { id: '955H', alias: "靈實專線", start: "寶琳站", end: "靈實醫院(九巴車廠)", via: "", nature: "混合", time: "20(來回)", length: "3.1km(來回)", difficulty: 1.5, image: "images/955H.jpg", description: "連接寶琳站與靈實醫院的平坦特快路線。適合通勤與旅遊，為需要前往醫院的用戶提供便利。", tags: ["將軍澳", "平坦", "醫院專線", "連接地鐵站", "通勤", "旅遊"], color: "#dd7e6b", gpx: [{ label: "來回", file: "955H循環.gpx" }] },
        { id: '960', alias: "終極旅遊線", start: "將軍澳村", end: "將軍澳創新園", via: "寶琳北路、寶順路、調景嶺站、將軍澳跨灣大橋、日出康城", nature: "旅遊", time: 80, length: "12.8km", difficulty: 5, image: "images/960.jpg", description: "終極旅遊線，繞經將軍澳大部分地區。由寶琳開出，途經坑口、尚德、調景嶺及將軍澳西後經過將軍澳跨灣大橋直達日出康城，最後前往將軍澳創新園，多坡路段適合專業單車訓練，讓你盡覽整個將軍澳地區風光。", tags: ["將軍澳", "旅遊專線", "運動訓練", "多坡", "長途", "大橋特快", "南北三寶", "創新園路線", "風景優美", "挑戰"], color: "#76a5af", gpx: [{ label: "往創新園", file: "960創新園.gpx" }, { label: "往寶琳", file: "960寶琳.gpx" }] },
        { id: '961', alias: "清水灣大環線", start: "維景灣畔", end: "康城西", via: "調景嶺站、唐賢街、至善街、怡明邨、北橋、康城海濱", nature: "混合", time: 30, length: "4.7km", difficulty: 3, image: "images/961.jpg", description: "一條連接康城與調景嶺維景灣畔的快速路線。路況少坡，讓康城居民可以方便地前往將軍澳中部。", tags: ["將軍澳", "少坡", "維景灣畔專線", "風景優美", "通勤", "旅遊"], color: "#93c47d", gpx: [{ label: "往康城", file: "961康城.gpx" }, { label: "往調景嶺", file: "961調景嶺.gpx" }] },
        { id: '961P', alias: "清水灣半島特快", start: "康城西", end: "將軍澳中心", via: "康城海濱、南橋、將軍澳海濱", nature: "旅遊", time: 20, length: "3.0km", difficulty: 3, image: "images/961P.jpg", description: "只於黃昏前後開放的單向騎行路線。從日出康城近大橋出發，途經南橋及將軍澳南梯台前往將軍澳中心，沿著海濱欣賞日落，最後前往將軍澳中心商場，亦可接駁渡輪前往。", tags: ["將軍澳", "旅遊專線", "黃昏日落", "單向", "海濱專線", "接駁渡輪", "快速"], color: "#93c47d", gpx: [{ label: "單向", file: "961P將軍澳.gpx" }] },
        { id: '962', alias: "創新園市中心線", start: "將軍澳創新園", end: null, via: "調景嶺站、將軍澳(入境事務大樓/地鐵站/唐賢街)", nature: "混合", time: 60, length: "9.4km", difficulty: 4, image: "images/962.jpg", description: "將軍澳市中心前往將軍澳創新園的最快的方法。途經將軍澳跨灣大橋，適合通勤族快速抵達。", tags: ["將軍澳", "多坡", "特快", "大橋特快", "創新園路線", "人流較少", "通勤", "旅遊"], color: "#c27ba0", gpx: [{ label: "往返", file: "962.gpx" }] },
        { id: '962A', alias: "大橋循環線", start: "峻瀅", end: null, via: "將軍澳(入境事務大樓/地鐵站/海濱)", nature: "混合", time: 50, length: "9.4km", difficulty: 4, image: "images/962A.jpg", description: "循環來往日出康城/峻瀅及將軍澳市中心或海濱的特快路線。路線設計，讓你可以同時體驗將軍澳跨灣大橋及將軍澳海濱的優美風景。", tags: ["將軍澳", "循環", "多坡", "特快", "海濱專線", "大橋特快", "接駁渡輪", "風景優美", "通勤", "旅遊"], color: "#c27ba0", gpx: [{ label: "單循環", file: "962A循環.gpx" }] },
        { id: '962P', alias: "創新園通勤專線", start: "將軍澳創新園", end: "將軍澳站", via: "將軍澳南", nature: "通勤", time: 30, length: "5.7km", difficulty: 3.5, image: "images/962P.jpg", description: "平日下午專為前往將軍澳創新園通勤的將軍澳市中心居民回家設計的單向特快路線。從創新園直達將軍澳市區，途經大橋並不途經調景嶺，快速便捷。", tags: ["將軍澳", "通勤專線", "單向", "多坡", "特快", "大橋特快", "創新園路線"], color: "#c27ba0", gpx: [{ label: "單向", file: "962P將軍澳.gpx" }] },
        { id: '962X', alias: "入境通勤專線", start: "峻瀅", end: "將軍澳站", via: "康城、將軍澳跨灣大橋、將軍澳入境事務大樓", nature: "通勤", time: 20, length: "4.3km", difficulty: 3.5, image: "images/962X.jpg", description: "平日上午專為前往將軍澳入境事務大樓或將軍澳市中心辦公的康城居民設計的特快路線。從康城直達將軍澳入境事務大樓及將軍澳站，途經將軍澳跨灣大橋，省時高效。", tags: ["將軍澳", "通勤專線", "康城專線", "單向", "多坡", "特快", "大橋特快"], color: "#c27ba0", gpx: [{ label: "單向", file: "962X康城.gpx" }] },
        { id: '966', alias: "維景灣畔線", start: "維景灣畔", end: "康城站", via: "調景嶺站、將軍澳跨灣大橋", nature: "混合", time: 18, length: "3.2km", difficulty: 3.5, image: "images/966.jpg", description: "連接康城站及調景嶺站/維景灣畔的特快路線。途經將軍澳跨灣大橋大橋，特快往來，同時適合通勤與旅遊。", tags: ["將軍澳", "多坡", "大橋特快", "康城專線", "維景灣畔專線", "通勤", "旅遊"], color: "#ff9900", gpx: [{ label: "往康城", file: "966康城.gpx" }, { label: "往調景嶺", file: "966調景嶺.gpx" }] },
        { id: '966A', alias: "康城通勤A線", start: "康城站", end: "調景嶺站", via: "將軍澳跨灣大橋", nature: "通勤", time: 15, length: "2.9km", difficulty: 3, image: "images/966A.jpg", description: "一條連接康城站(日出康城)與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966A康城.gpx" }, { label: "往調景嶺", file: "966A調景嶺.gpx" }] },
        { id: '966B', alias: "康城通勤B線", start: "康城領都", end: "調景嶺站", via: "將軍澳跨灣大橋", nature: "通勤", time: 18, length: "3.3km", difficulty: 3.5, image: "images/966B.jpg", description: "一條連接日出康城領都與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966B康城.gpx" }, { label: "往調景嶺", file: "966B調景嶺.gpx" }] },
        { id: '966C', alias: "康城通勤C線", start: "峻瀅", end: "調景嶺站", via: "日出康城、將軍澳跨灣大橋", nature: "通勤", time: 22, length: "3.8km", difficulty: 4, image: "images/966C.jpg", description: "一條連接峻瀅/日出康城與調景嶺站的特快通勤路線。取道將軍澳跨灣大橋直接連接兩地，方便峻瀅及康城居民前往調景嶺或快速轉乘地鐵。", tags: ["將軍澳", "通勤專線", "多坡", "大橋特快", "連接地鐵站", "連接巴士總站", "康城專線"], color: "#ff9900", gpx: [{ label: "往康城", file: "966C康城.gpx" }, { label: "往調景嶺", file: "966C調景嶺.gpx" }] },
        { id: '966T', alias: "大橋旅遊線", start: "調景嶺站", end: "康城站", via: "將軍澳跨灣大橋", nature: "旅遊", time: 16, length: "3.0km", difficulty: 3, image: "images/966T.jpg", description: "專為遊覽觀光設計的大橋特快路線。連接康城站與調景嶺站，適合單車新手挑戰自我，欣賞大橋景色。", tags: ["將軍澳", "旅遊專線", "多坡", "大橋特快", "新手必試", "連接地鐵站"], color: "#ff9900", gpx: [{ label: "往康城", file: "966T康城.gpx" }, { label: "往調景嶺", file: "966T調景嶺.gpx" }] },
        { id: 'S90', alias: "康城海濱線", start: "清水灣半島", end: null, via: "康城海濱", nature: "通勤", time: 20, length: "3.5km(來回)", difficulty: 2.5, image: "images/S90.jpg", description: "清水灣半島專線，連接將軍澳站。路況少坡，適合通勤，為居民提供一條快速的地鐵接駁選擇。", tags: ["將軍澳", "通勤專線", "少坡", "特快", "清水灣半島專線", "連接地鐵站"], color: "#00ff00", textColor: "black", gpx: [{ label: "來回", file: "S90康城循環.gpx" }] },
        { id: 'S91', alias: "清半接駁線", start: "清水灣半島", end: "將軍澳站", via: "北橋、怡明邨", nature: "混合", time: 6, length: "1.1km", difficulty: 1, image: "images/S91.jpg", description: "循環來往清水灣半島與康城站的循環線。適合清水灣半島居民通勤，也適合體驗康城海濱，道路平坦，讓你輕鬆騎行，探索康城風光。", tags: ["將軍澳", "平坦", "循環", "清水灣半島專線", "通勤", "旅遊"], color: "#ffff00", textColor: "black", gpx: [{ label: "往清水灣半島", file: "S91清水灣半島.gpx" }, { label: "往調景嶺", file: "S91調景嶺.gpx" }] },
        { id: 'ST01', alias: " ", start: "沙田站", end: "第一城", via: "城門河畔", nature: "通勤", time: "待定", length: "待定", difficulty: "待定", image: "images/st_coming_soon.jpg", description: "規劃中的沙田路線，敬請期待！", tags: ["沙田區", "通勤"], color: "#333", link: "/coming_soon.html", gpx: [] },
        { id: '7E', alias: "東岸板道（東）線", start: "北角碼頭", end: "東岸板道 (東)", via: "北角海濱花園、東岸板道", nature: "旅遊", time: 6, length: "1.0km", difficulty: 1, image: "images/7E.jpg", description: "沿港島北岸東行，由北角碼頭出發，途經北角海濱花園，沿東岸板道欣賞維多利亞港及九龍海景，最終抵達東岸板道（東）。路線平坦，是適合親子及休閒的海濱單車體驗。", tags: ["港島", "海濱", "新手必試", "風景優美", "平坦"], color: "#00838F", gpx: [{ label: "往東岸板道(東)", file: "7E東岸板道.gpx" }, { label: "往北角碼頭", file: "7E北角碼頭.gpx" }] },
        { id: '7W', alias: "東岸板道（西）線", start: "北角碼頭", end: "東岸板道 (西)", via: "北角海濱花園、東岸板道", nature: "旅遊", time: 6, length: "1.0km", difficulty: 1, image: "images/7W.jpg", description: "沿港島北岸西行，由北角碼頭出發，途經北角匯及糖水道，沿東岸板道到達東岸板道（西）。路線平坦，可欣賞維多利亞港全景，是悠閒海濱騎行的絕佳選擇。", tags: ["港島", "海濱", "新手必試", "風景優美", "平坦"], color: "#00838F", gpx: [{ label: "往東岸板道(西)", file: "7W東岸板道.gpx" }, { label: "往北角碼頭", file: "7W北角碼頭.gpx" }] },
    ];
    // Expose routes for the PWA app (routes.html uses this to merge display data)
    window.CTRCHK_ROUTES = routes;
    // =========================================================================
    const blogPosts = [
        {
            id: 'welcome-post', // 給文章一個獨特的 ID (不要用純數字開頭)
            title: '歡迎來到城市運輸單車網誌！',
            author: 'CTRC HK 團隊',
            date: '2025年10月21日', // 你可以修改日期
            image: 'images/blog/blog-welcome-banner.jpg', // 【新】文章預覽圖 (你需要準備一張圖片)
            summary: '你好！歡迎踏入香港城市運輸單車 (CTRC HK) 的網誌空間。我們創立這個平台的初衷，源於對單車的熱愛，以及對更環保、更健康城市生活的嚮往...', // 文章摘要
            content: `
                <p>你好！歡迎踏入香港城市運輸單車 (CTRC HK) 的網誌空間。我們創立這個平台的初衷，源於對單車的熱愛，以及對更環保、更健康城市生活的嚮往。</p>
                <p>「城市減碳，由我做起」—— 這不僅是口號，更是我們希望透過單車出行實現的目標。在這個網誌中，我們將會分享：</p>
                <ul>
                    <li><strong>路線故事：</strong> 探索我們精心規劃的路線背後的故事、風景亮點和騎行貼士。</li>
                    <li><strong>單車知識：</strong> 從基礎保養到進階技巧，讓你更懂你的單車夥伴。</li>
                    <li><strong>城市觀察：</strong> 分享我們對香港單車文化、基建發展的觀察與思考。</li>
                    <li><strong>最新動態：</strong> 關於 城市運輸單車的最新消息、活動預告等。</li>
                </ul>
                <p>我們相信，單車不僅是一種交通工具，更是一種生活態度，一種連結城市與自然的媒介。無論你是經驗豐富的騎手，還是剛對單車產生興趣的新手，我們都希望這個網誌能為你帶來啟發和實用的資訊。</p>
                <p>準備好和我們一起，用兩個輪子探索香港的無限可能了嗎？敬請期待我們的第一篇正式文章！</p>
                <p>如果你有任何想看的主題或建議，歡迎隨時<a href="/contact">聯絡我們</a>。</p>
            ` // 完整的文章 HTML 內容
        }
    ];

    // =========================================================================
    // 全站共用函式 (你原有的程式碼)
    // =========================================================================

    /**
     * 異步載入共用的 HTML 元件 (例如 header, footer)
     */
    async function loadSharedComponents() {
        const components = {
            'header.html': '#header-placeholder'
        };

        const fetchPromises = Object.entries(components).map(async ([file, placeholderId]) => {
            const placeholder = document.querySelector(placeholderId);
            
            if (placeholder) {
                try {
                    const response = await fetch(file);
                    if (!response.ok) {
                        throw new Error(`Network response was not ok for ${file}`);
                    }
                    const data = await response.text();
                    placeholder.innerHTML = data;
                } catch (error) {
                    console.error('Error loading component:', file, error);
                    placeholder.innerHTML = `<p style="color:red; text-align:center;">Error loading ${file}.</p>`;
                }
            }
        });

        // 等待所有元件都載入完成
        await Promise.all(fetchPromises);
        console.log('--- 共用元件 (Header) 已載入完成 ---');
        
        // ***** 這是唯一的修改點 *****
        // Header 載入完成後，立即呼叫 updateNavUI 來更新登入狀態
        updateNavUI();
        // 更新語言切換連結，確保指向當前頁面的對應語言版本
        updateLangLink();
        // 初始化語言切換下拉選單
        initLangSwitcher();
        // ***************************
    }

    /**
     * 初始化語言切換下拉選單（點擊地球圖示展開）
     * 點擊語言連結時，儲存偏好到 localStorage 並導向對應語言頁面
     */
    function initLangSwitcher() {
        const btn = document.getElementById('lang-switcher-btn');
        const dropdown = document.getElementById('lang-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', function() {
            dropdown.classList.remove('open');
        });

        dropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // Attach lang preference handler to EN link
        const enLink = document.getElementById('lang-en-link');
        if (enLink) {
            enLink.addEventListener('click', function() {
                localStorage.setItem('appLang', 'en');
            });
        }
        // Attach lang preference handler to ZH link
        const zhLink = document.getElementById('lang-zh-link');
        if (zhLink) {
            zhLink.addEventListener('click', function() {
                localStorage.setItem('appLang', 'zh');
            });
        }
    }

    /**
     * 更新語言切換連結，使其指向當前頁面的對應語言版本。
     * - 中文頁面 (#lang-en-link): / → /en/index，/about → /en/about，以此類推
     * - 英文頁面 (#lang-zh-link): /en/about → /about，/en/index → /
     */
    function updateLangLink() {
        const path = window.location.pathname;
        const search = window.location.search;
        const enLink = document.getElementById('lang-en-link');
        const zhLink = document.getElementById('lang-zh-link');

        if (enLink) {
            // 中文頁面：根路徑 → /en/index，其餘路徑在前面加 /en
            const enPath = (path === '/') ? '/en/index' : '/en' + path;
            enLink.href = enPath + search;
        }

        if (zhLink) {
            // 英文頁面：移除 /en 或 /en/ 前綴
            // /en/about → /about，/en/index → /，/en → /
            const stripped = path.replace(/^\/en(\/|$)/, '/');
            const zhPath = (stripped === '/index') ? '/' : stripped;
            zhLink.href = zhPath + search;
        }
    }
        
    /**
     * 根據評分產生星星圖示 HTML
     */
    function generateStarRating(rating) {
        const totalStars = 5;
        let starsHtml = '<span class="star-rating">';
        const fullStars = Math.floor(rating);
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<i class="fas fa-star"></i>';
        }
        if (rating % 1 >= 0.5) {
            starsHtml += '<i class="fas fa-star-half-stroke"></i>';
        }
        const emptyStars = totalStars - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<i class="far fa-star"></i>';
        }
        starsHtml += '</span>';
        return starsHtml;
    }
    
    /**
     * 初始化所有帶有 .animated-element 的元素，當它們進入可視範圍時顯示。
     */
    function initAnimatedElements() {
        const animatedElements = document.querySelectorAll('.animated-element');
        if (animatedElements.length === 0) return;

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            animatedElements.forEach(el => observer.observe(el));
        } else {
            animatedElements.forEach(el => el.classList.add('is-visible'));
        }
    }

    // =========================================================================
    // Blog 頁面處理函式 (你原有的程式碼)
    // =========================================================================

    function initBlogListPage() {
        const container = document.getElementById('blog-list-container');
        if (!container) return; 

        container.innerHTML = ''; 

        if (blogPosts && blogPosts.length > 0) {
            blogPosts.forEach(post => {
                const postElement = document.createElement('article');
                postElement.className = 'blog-post-summary animated-element';
                postElement.innerHTML = `
                    <div class="post-summary-image">
                        <a href="/blog_post?id=${post.id}"> 
                            <img src="${post.image}" alt="${post.title}">
                        </a>
                    </div>
                    <div class="post-summary-content">
                        <h2><a href="/blog_post?id=${post.id}">${post.title}</a></h2>
                        <div class="post-meta-summary">
                            <span><i class="fas fa-user"></i> ${post.author}</span>
                            <span><i class="fas fa-calendar-alt"></i> ${post.date}</span>
                        </div>
                        <p class="post-excerpt">${post.summary}</p>
                        <a href="/blog_post?id=${post.id}" class="read-more-link">閱讀更多 &rarr;</a>
                    </div>
                `;
                container.appendChild(postElement);
            });
            initAnimatedElements();
        } else {
            container.innerHTML = '<p>目前還沒有文章。</p>';
        }
    }

    function initBlogPostPage() {
        const container = document.getElementById('blog-post-container');
        if (!container) return;

        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('id');

        if (postId && blogPosts) {
            const post = blogPosts.find(p => p.id === postId);

            if (post) {
                document.title = `${post.title} - 香港城市運輸單車`;
                container.innerHTML = `
                    <div class="post-header">
                        <h1>${post.title}</h1>
                        <div class="post-meta">
                            <span><i class="fas fa-user"></i> ${post.author}</span>
                            <span><i class="fas fa-calendar-alt"></i> ${post.date}</span>
                        </div>
                    </div>
                    <img src="${post.image}" alt="${post.title}" class="post-featured-image">
                    <div class="post-content">
                        ${post.content}
                    </div>
                    <a href="/blog" class="back-to-blog"><i class="fas fa-arrow-left"></i> 返回網誌列表</a>
                `;
                 initAnimatedElements();
            } else {
                container.innerHTML = '<p style="text-align: center;">找不到指定的文章。</p>';
                 document.title = '找不到文章 - 香港城市運輸單車';
            }
        } else {
            container.innerHTML = '<p style="text-align: center;">文章 ID 無效。</p>';
             document.title = '文章 ID 無效 - 香港城市運輸單車';
        }
    }

    // =========================================================================
    // 頁面專屬初始化函式 (你原有的程式碼)
    // =========================================================================

    function initHomePage() {
        const container = document.getElementById('routes-preview-container');
        if (!container) return;
        const featuredRouteIds = ['900', '960', '966T'];
        const routesToShow = featuredRouteIds.map(id => routes.find(route => route.id === id));
        container.innerHTML = '';
        routesToShow.forEach(route => {
            if (route) {
                const card = document.createElement('div');
                card.className = 'route-card';
                card.innerHTML = `
                    <a href="/route_detail?id=${route.id}">
                        <img src="${route.image}" alt="${route.alias || route.id}">
                        <div class="route-card-title">
                            <h3>
                                <span class="route-card-id" style="background-color: ${route.color}; color: ${route.textColor || 'white'}">
                                    ${route.id}
                                </span>
                                ${route.alias || '(無別稱)'}
                            </h3>
                        </div>
                    </a>
                `;
                container.appendChild(card);
            }
        });
    }

    function initEnHomePage() {
        const container = document.getElementById('en-routes-preview-container');
        if (!container) return;
        const featuredRouteIds = ['900', '960', '966T'];
        const routesToShow = featuredRouteIds.map(id => enRoutes.find(route => route.id === id));
        container.innerHTML = '';
        routesToShow.forEach(route => {
            if (route) {
                const card = document.createElement('div');
                card.className = 'route-card';
                card.innerHTML = `
                    <a href="/en/route_detail?id=${route.id}">
                        <img src="/${route.image}" alt="${route.alias || route.id}">
                        <div class="route-card-title">
                            <h3>
                                <span class="route-card-id" style="background-color: ${route.color}; color: ${route.textColor || 'white'}">
                                    ${route.id}
                                </span>
                                ${route.alias || '(No alias)'}
                            </h3>
                        </div>
                    </a>
                `;
                container.appendChild(card);
            }
        });
    }

    function initRoutesPage() {
        const allRoutesContainer = document.getElementById('all-routes-container');
        const heroSearchInput = document.getElementById('hero-search-input');
        if (!allRoutesContainer || !heroSearchInput) return;

        // ── 解鎖等級對照表（50 級系統，批次間距更長）────────────────────────
        const ROUTE_UNLOCK = {
            '900':1,'900A':1,'966T':1,
            '914':4,'914H':4,'966A':8,'966':8,
            '900S':1,'910':5,'914B':1,'901P':15,
            '920':22,'966B':22,
            '920X':30,'923':30,'966C':30,
            '928':38,'929':38,'961':38,'961P':38,
            '932':45,'935':45,'939':45,'939M':45,'962':45,'962A':45,
            '955':50,'955A':50,'955H':50,'960':50,'962P':50,'962X':50,
            'X935':50,'S90':50,'S91':50,
        };
        const ROUTE_XP = {
            '900':150,'900A':120,'966':110,'914':80,'966A':90,'900S':595,'901P':140,
            '910':260,'914B':290,'914H':170,'920':130,'966B':90,'920X':100,'923':160,
            '966C':90,'928':170,'929':160,'966T':90,'961':130,'961P':100,'932':220,
            '935':250,'939':120,'939M':120,'955':110,'955A':60,'955H':80,'960':400,
            '962':250,'962A':250,'962P':150,'962X':130,'X935':210,'S90':200,'S91':200,
        };
        // 獲取使用者當前等級
        function getUserLevel() {
            try {
                const raw = localStorage.getItem('user');
                if (!raw) return 0; // 未登入：不顯示鎖定狀態
                const u = JSON.parse(raw);
                return Math.max(1, parseInt(u.level || 1, 10));
            } catch (e) { return 0; }
        }

        const filterCategories = {
            "路線區域": ["將軍澳", "沙田區"],
            "路線類別": ["通勤", "旅遊", "單向", "循環", "快速", "特快", "長途"],
            "路線特色": ["新手必試", "風景優美", "黃昏日落", "挑戰", "運動訓練", "平坦", "少坡", "多坡"],
            "路線稱號": ["海濱專線", "坑口北專線", "維景灣畔專線", "清水灣半島專線", "康城專線", "寶琳調景嶺線", "學校線", "創新園路線", "南北三寶"],
            "接駁交通": ["連接地鐵站", "連接巴士總站", "接駁渡輪"]
        };
        const tagMap = { "單向": "單向線", "循環": "循環線" };
        let activeFilters = {};
        let searchTerm = '';

        const filterControls = document.createElement('div');
        filterControls.className = 'filter-controls';
        
        for (const category in filterCategories) {
            activeFilters[category] = [];
            const container = document.createElement('div');
            container.className = 'filter-dropdown-container';
            const button = document.createElement('button');
            button.className = 'filter-category-button';
            button.textContent = category;
            const menu = document.createElement('div');
            menu.className = 'filter-dropdown-menu';
            filterCategories[category].forEach(tag => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = tag;
                checkbox.dataset.category = category;
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${tag}`));
                menu.appendChild(label);
            });
            container.appendChild(button);
            container.appendChild(menu);
            filterControls.appendChild(container);
        }
        
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container';
        filtersContainer.appendChild(filterControls);
        allRoutesContainer.before(filtersContainer);

        heroSearchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            applyFilters();
        });

        document.querySelectorAll('.filter-category-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentMenu = button.nextElementSibling;
                document.querySelectorAll('.filter-dropdown-menu.show').forEach(menu => {
                    if (menu !== currentMenu) menu.classList.remove('show');
                });
                currentMenu.classList.toggle('show');
            });
        });

        window.addEventListener('click', () => {
            document.querySelectorAll('.filter-dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        });

        document.querySelectorAll('.filter-dropdown-menu input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const category = checkbox.dataset.category;
                const value = checkbox.value;
                if (checkbox.checked) {
                    if (!activeFilters[category].includes(value)) activeFilters[category].push(value);
                } else {
                    activeFilters[category] = activeFilters[category].filter(item => item !== value);
                }
                applyFilters();
            });
        });

        function applyFilters() {
            let filteredByTags = [...routes];
            const hasActiveTagFilters = Object.values(activeFilters).some(tags => tags.length > 0);

            if (hasActiveTagFilters) {
                filteredByTags = filteredByTags.filter(route => {
                    return Object.entries(activeFilters).every(([category, selectedTags]) => {
                        if (selectedTags.length === 0) return true;
                        return selectedTags.some(tag => {
                            const actualTag = tagMap[tag] || tag;
                            if ((tag === "通勤" || tag === "旅遊") && route.nature === "混合") return true;
                            return route.tags.includes(actualTag);
                        });
                    });
                });
            }
            
            let finalFilteredRoutes = filteredByTags;
            if (searchTerm.trim() !== '') {
                finalFilteredRoutes = filteredByTags.filter(route => {
                    const searchFields = [
                        route.id, route.alias, route.start, route.end || '', route.via || ''
                    ].join(' ').toLowerCase();
                    return searchFields.includes(searchTerm);
                });
            }
            renderRoutes(finalFilteredRoutes);
        }

        function renderRoutes(routesToRender) {
            allRoutesContainer.innerHTML = '';
            const userLvl = getUserLevel();
            const isLoggedIn = !!localStorage.getItem('accessToken');
            if (routesToRender.length > 0) {
                routesToRender.forEach(route => {
                    const card = document.createElement('div');
                    card.className = 'route-card-full animated-element';
                    const link = route.link || `/route_detail?id=${route.id}`;
                    const needed = route.unlock_level || ROUTE_UNLOCK[route.id] || 1;
                    const isLocked = isLoggedIn && userLvl > 0 && userLvl < needed;
                    const xp = ROUTE_XP[route.id] || 0;
                    const lockBadge = isLocked
                        ? `<span style="background:#e74c3c;color:#fff;font-size:0.72em;padding:0.2em 0.6em;border-radius:10px;font-weight:bold;">🔒 Lv.${needed}</span>`
                        : (xp > 0 && isLoggedIn ? `<span style="background:#BFE340;color:#2c3e50;font-size:0.72em;padding:0.2em 0.6em;border-radius:10px;font-weight:bold;">+${xp} XP</span>` : '');
                    card.innerHTML = `
                        <a href="${link}" class="${route.id.startsWith('ST') ? 'disabled-link' : ''}">
                            <div class="route-card-header">
                                <span class="route-id-code" style="background-color: ${route.color}; color: ${route.textColor || 'white'};">${route.id}</span>
                                <h3 class="route-alias">${route.alias || '(無別稱)'}</h3>
                                ${lockBadge}
                            </div>
                            <div class="route-card-content">
                                <p><strong>起點:</strong> ${route.start}</p>
                                <p><strong>終點:</strong> ${route.end || '(循環線)'}</p>
                            </div>
                        </a>
                    `;
                    allRoutesContainer.appendChild(card);
                });
            } else {
                allRoutesContainer.innerHTML = '<p style="text-align: center; font-size: 1.2em; color: #555;">找不到符合條件的路線。</p>';
            }
            initAnimatedElements();
        }
        
        renderRoutes(routes);
    }
    
    function initRouteDetailPage() {
        const routeDetailContainer = document.getElementById('route-detail-container');
        if (!routeDetailContainer) return;

        const urlParams = new URLSearchParams(window.location.search);
        const routeId = urlParams.get('id');

        if (routeId) {
            const route = routes.find(r => r.id === routeId);
            if (route) {
                document.title = `香港城市運輸單車 - ${route.alias || route.id}`;
                let gpxButtonsHtml = '';
                if (route.gpx && route.gpx.length > 0) {
                    // 檢查用戶是否為高級會員
                    const isSenior = (() => {
                        try {
                            const userData = localStorage.getItem('user');
                            if (!userData) return false;
                            const user = JSON.parse(userData);
                            return user.user_role === 'senior' || user.role === 'senior';
                        } catch (e) { return false; }
                    })();

                    if (isSenior) {
                        gpxButtonsHtml = `
                            <div class="gpx-download-container">
                                ${route.gpx.map(gpxFile => `
                                    <a href="gpx/${gpxFile.file}" download="${gpxFile.file}" class="gpx-download-button">
                                        ${gpxFile.label} <i class="fas fa-download"></i>
                                    </a>
                                `).join('')}
                            </div>
                        `;
                    } else {
                        const isLoggedInUser = !!localStorage.getItem('accessToken');
                        const lockMsg = isLoggedInUser
                            ? '升級為高級會員以下載 GPX 路線文件'
                            : '登入並成為高級會員以下載 GPX 路線文件';
                        gpxButtonsHtml = `
                            <div class="gpx-download-container">
                                <div class="gpx-locked-notice" style="background:#f5f5f5; border:1px solid #ddd; border-radius:8px; padding:1em; text-align:center; margin-top:1em;">
                                    <i class="fas fa-lock" style="color:#999; font-size:1.5em; display:block; margin-bottom:0.5em;"></i>
                                    <p style="color:#666; margin:0 0 0.8em;">${lockMsg}</p>
                                    ${isLoggedInUser
                                        ? `<a href="/profile-setup" class="cta-button" style="font-size:0.85em; padding:0.5em 1.2em;">升級高級會員</a>`
                                        : `<a href="/login" class="cta-button" style="font-size:0.85em; padding:0.5em 1.2em;">前往登入</a>`
                                    }
                                </div>
                            </div>
                        `;
                    }
                }
                routeDetailContainer.innerHTML = `
                    <div class="route-hero animated-element" style="background-color: ${route.color}; color: ${route.textColor || 'white'};">
                        <h1 class="route-hero-title">${route.alias || '路線詳情'}</h1>
                        <p class="route-id-text">路線編號: ${route.id}</p>
                    </div>
                    <div class="route-detail-grid animated-element">
                        <div class="route-image-container">
                            <img src="${route.image}" alt="${route.alias || route.id}" class="route-detail-image">
                            ${gpxButtonsHtml}
                        </div>
                        <div class="route-detail-info">
                            <p class="route-description">${route.description}</p>
                            <div class="route-stats">
                                <div><strong>起點:</strong> ${route.start}</div>
                                <div><strong>終點:</strong> ${route.end || '循環線'}</div>
                                <div><strong>主要途經:</strong> ${route.via || '無'}</div>
                                <div><strong>性質:</strong> ${route.nature}</div>
                                <div><strong>預計全程行車時間:</strong> ${route.time}分鐘</div>
                                <div><strong>路線全長:</strong> ${route.length}</div>
                                <div><strong>難度:</strong> ${generateStarRating(route.difficulty)} (${route.difficulty}/5)</div>
                            </div>
                            <div class="route-tags-container">
                                <strong>標籤:</strong>
                                <div class="route-tags">
                                    ${route.tags.map(tag => `<span class="route-tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                initAnimatedElements();
            } else {
                routeDetailContainer.innerHTML = '<p>找不到指定的路線。</p>';
            }
        }
    }

    // =========================================================================
    // 英文路線資料 (English route data)
    // =========================================================================
    const enRoutes = [
        { id: '900', alias: "Coastal Commuter", start: "Po Lam (New Town Plaza II)", end: "Tseung Kwan O (Choi Ming)", via: "King Lam Estate, HK Velodrome, TKO Waterfront, Tseung Kwan O Station", nature: "Leisure", time: 40, length: "5.5 km", difficulty: 3, image: "images/900.jpg", description: "The perfect beginner-friendly waterfront route. The full journey takes under an hour, with minimal inclines and stunning scenery, seamlessly connecting Po Lam and Tseung Kwan O while passing multiple rest stops along the way.", tags: ["Tseung Kwan O", "Waterfront", "Po Lam–TKO Line", "Beginner Friendly", "Scenic", "Few Slopes"], color: "#990000", gpx: [{ label: "To Po Lam", file: "900寶琳.gpx" }, { label: "To Tseung Kwan O", file: "900調景嶺.gpx" }] },
        { id: '900A', alias: "Po Lam–TKO Express", start: "Po Lam (New Town Plaza II)", end: "Tseung Kwan O Terminal", via: "King Lam Estate, Po Shun Road, Tseung Kwan O Station", nature: "Mixed", time: 20, length: "4.2 km", difficulty: 1.5, image: "images/900A.jpg", description: "A relaxed route designed for cycling beginners. Using the Po Shun Road dedicated cycle track between Po Lam and Tseung Kwan O, the terrain is flat and only takes 20 minutes — perfect for a leisurely weekend ride.", tags: ["Tseung Kwan O", "Po Lam–TKO Line", "Beginner Friendly", "Express", "Flat", "Commute", "Leisure"], color: "#990000", gpx: [{ label: "To Po Lam", file: "900A寶琳.gpx" }, { label: "To Tseung Kwan O", file: "900A調景嶺.gpx" }] },
        { id: '900S', alias: "Po Lam Sunset Run", start: "Tseung Kwan O Terminal", end: "Po Lam Fire Station", via: "TKO Waterfront, Po Lam North Road", nature: "Leisure", time: 40, length: "5.0 km", difficulty: 3.5, image: "images/900S.jpg", description: "A one-way express route ideal for an evening ride. Head straight from the TKO waterfront to Po Lam East and enjoy beautiful sunset views along the way — the full journey takes just 40 minutes.", tags: ["Tseung Kwan O", "One-way", "Po Lam–TKO Line", "Sunset", "Fast", "Few Slopes", "Scenic"], color: "#990000", gpx: [{ label: "To Po Lam", file: "900S寶琳.gpx" }] },
        { id: '901P', alias: "Po Lam North Fast Line", start: "Po Lam (TKO Village)", end: "TKO Centre", via: "Po Hong Road, TKO Waterfront, Tseung Kwan O Station", nature: "Mixed", time: 40, length: "5.6 km", difficulty: 3.5, image: "images/901P.jpg", description: "A fast-track route connecting Po Lam North, Po Lam West and Tseung Kwan O City Centre and Tseung Kwan O Station. Suitable for both commuting and leisure.", tags: ["Tseung Kwan O", "Fast", "Po Lam–TKO Line", "Flat", "Commute", "Leisure"], color: "#e06666", gpx: [{ label: "To Po Lam", file: "901P寶琳.gpx" }, { label: "To Tseung Kwan O", file: "901P調景嶺.gpx" }] },
        { id: '910', alias: "Hang Hau Loop", start: "Hang Hau Station", end: "Hang Hau North, Yuk Ming Court", via: "Hang Hau North, Yuk Ming Court", nature: "Mixed", time: 15, length: "3.1 km", difficulty: 2, image: "images/910.jpg", description: "A dual-loop around Hang Hau Station and its surrounding area, suitable for commuting and leisure. The route connects the MTR station and bus terminal, with less traffic and few slopes — an ideal choice for cycling training.", tags: ["Tseung Kwan O", "Loop", "Hang Hau North", "Few Slopes", "Training", "MTR Connection", "Bus Terminal", "Commute", "Leisure"], color: "#3c78d8", gpx: [{ label: "Clockwise", file: "910順時針.gpx" }, { label: "Anti-clockwise", file: "910逆時針.gpx" }] },
        { id: '914', alias: "King Lam Express", start: "Po Lam (King Lam Bike Station)", end: "Hang Hau Station", via: "", nature: "Commute", time: 4, length: "0.8 km", difficulty: 0.5, image: "images/914.jpg", description: "The dedicated commuter line for King Lam Estate. All-day service connecting Hang Hau Station and King Lam Estate with flat terrain and convenient transport connections — the full journey takes just 4 minutes, making it the top choice for saving commute time.", tags: ["Tseung Kwan O", "Commuter", "Flat", "MTR Connection", "Bus Terminal", "Few Slopes"], color: "#073763", gpx: [{ label: "To Po Lam", file: "914寶琳.gpx" }, { label: "To Hang Hau", file: "914坑口.gpx" }] },
        { id: '914B', alias: "Po Lam–Hang Hau Special", start: "Po Lam (New Town Plaza II)", end: "Hang Hau", via: "King Lam Estate, Hang Hau Station, Hau Tak Estate", nature: "Leisure", time: 12, length: "3.0 km", difficulty: 2, image: "images/914B.jpg", description: "A leisure route connecting Po Lam New Town Plaza, Hang Hau Station and Hang Hau. The terrain is flat, with MTR and bus terminal connections along the way, providing a convenient Hang Hau express service.", tags: ["Tseung Kwan O", "Hang Hau North", "Flat", "MTR Connection", "Bus Terminal", "Few Slopes"], color: "#073763", gpx: [{ label: "To Po Lam", file: "914B寶琳.gpx" }, { label: "To Hang Hau", file: "914B醫院.gpx" }] },
        { id: '914H', alias: "Hospital Express", start: "Hang Hau Station", end: "TKO Hospital", via: "", nature: "Mixed", time: 6, length: "1.0 km", difficulty: 1, image: "images/914H.jpg", description: "An all-day express connecting Hang Hau Station and TKO Hospital for both commuters and leisure cyclists. Flat terrain with less traffic provides a quick and quiet hospital route.", tags: ["Tseung Kwan O", "Hang Hau North", "Hospital", "MTR Connection", "Few Slopes", "Quiet", "Commute", "Leisure"], color: "#073763", gpx: [{ label: "To Hang Hau", file: "914H坑口.gpx" }, { label: "To Hospital", file: "914H醫院.gpx" }] },
        { id: '920', alias: "Sheung Tak Special", start: "Baycrest", end: "Po Lam Station", via: "TKO School Belt, TKO Centre, Sheung Tak, Hang Hau Station, Po Lam School Belt", nature: "Leisure", time: 30, length: "4.6 km", difficulty: 3, image: "images/920.jpg", description: "A leisure route deep into the core districts of Tseung Kwan O, passing through Tseung Kwan O, Hang Hau and Po Lam stations so you can fully explore Tseung Kwan O.", tags: ["Tseung Kwan O", "Leisure", "Few Slopes", "Baycrest Line", "MTR Connection", "School Route"], color: "#660000", gpx: [{ label: "To Po Lam", file: "920寶琳.gpx" }, { label: "To Tseung Kwan O", file: "920調景嶺.gpx" }] },
        { id: '920X', alias: "Baycrest Express", start: "Baycrest", end: "Po Lam Station", via: "Choi Ming Court", nature: "Mixed", time: 20, length: "3.5 km", difficulty: 2.5, image: "images/920X.jpg", description: "A fast-track route from Baycrest and Choi Ming directly to Po Lam Station. Compared to route 920, this route avoids detours around TKO districts, with flat terrain suitable for commuting and cycling training.", tags: ["Tseung Kwan O", "Flat", "Express", "Training", "Beginner Friendly", "Baycrest Line", "MTR Connection", "Commute", "Leisure"], color: "#660000", gpx: [{ label: "To Po Lam", file: "920X寶琳.gpx" }, { label: "To Tseung Kwan O", file: "920X調景嶺.gpx" }] },
        { id: '923', alias: "City Centre Loop", start: "Tseung Kwan O Terminal", end: null, via: "Velodrome Park, TKO Ferry Pier, TKO Waterfront, Tseung Kwan O Centre, Immigration Tower", nature: "Mixed", time: 40, length: "5.6 km", difficulty: 3.5, image: "images/923.jpg", description: "A flat loop connecting Tseung Kwan O, Sheung Tak, the Velodrome and TKO City Centre. Convenient transport connections make this suitable for commuting and leisure.", tags: ["Tseung Kwan O", "Loop", "Flat", "MTR Connection", "Commute", "Leisure"], color: "#ff0000", gpx: [{ label: "Clockwise", file: "923順時針.gpx" }, { label: "Anti-clockwise", file: "923逆時針.gpx" }] },
        { id: '928', alias: "Waterfront Express", start: "Po Lam Station", end: "Tseung Kwan O (Yung Ming)", via: "Spirit of Holy, Tseung Kwan O Station, TKO Waterfront", nature: "Mixed", time: "40 (to TKO) / 30 (to Po Lam)", length: "6.0 km (to TKO) / 4.8 km (to Po Lam)", difficulty: 3.5, image: "images/928.jpg", description: "A beginner-friendly waterfront express route. With minimal inclines and stunning scenery, it connects Po Lam City Centre, Tseung Kwan O Station and the TKO Waterfront, with ferry connections along the way for a multi-modal experience.", tags: ["Tseung Kwan O", "Po Lam–TKO Line", "Beginner Friendly", "Few Slopes", "Waterfront", "Express", "Scenic", "MTR Connection", "Ferry", "Commute", "Leisure"], color: "#783f04", gpx: [{ label: "To Po Lam", file: "928寶琳.gpx" }, { label: "To Tseung Kwan O", file: "928將軍澳.gpx" }] },
        { id: '929', alias: "Hang Hau Rapid", start: "Hang Hau Station", end: "Tseung Kwan O Terminal", via: "Hang Hau North, TKO Waterfront, Tseung Kwan O Station, Tseung Kwan O Station", nature: "Mixed", time: 35, length: "6.2 km", difficulty: 3, image: "images/929.jpg", description: "A Hang Hau North speciality route with flat terrain, connecting Hang Hau districts, TKO City Centre and Tseung Kwan O. This versatile route is great for cycling beginners.", tags: ["Tseung Kwan O", "Beginner Friendly", "Flat", "Hang Hau North", "Fast", "Ferry", "Commute", "Leisure"], color: "#f1c232", gpx: [{ label: "To Hang Hau", file: "929坑口.gpx" }, { label: "To Tseung Kwan O", file: "929調景嶺.gpx" }] },
        { id: '932', alias: "Hang Hau–LOHAS Link", start: "Hang Hau Station", end: "TKO Innovation Hub", via: "Hang Hau North, North Bridge, Clear Water Bay Peninsula, LOHAS Park Waterfront, LOHAS Park", nature: "Mixed", time: 45, length: "8.1 km", difficulty: 4, image: "images/932.jpg", description: "A long-distance express route connecting Hang Hau, Clear Water Bay Peninsula, LOHAS Park and the Innovation Hub. With few slopes along the waterfront, this is an excellent choice for long-distance cycling challenges.", tags: ["Tseung Kwan O", "Long Distance", "Few Slopes", "CWB Peninsula", "Waterfront", "Scenic", "Hang Hau North", "Fast", "Innovation Hub", "Commute", "Leisure"], color: "#ff00ff", gpx: [{ label: "To Innovation Hub", file: "932創新園.gpx" }, { label: "To Hang Hau", file: "932坑口.gpx" }] },
        { id: '935', alias: "North–South Route", start: "Po Lam (TKO Village)", end: "TKO Innovation Hub", via: "Po Hong Road, North Bridge, LOHAS Park Waterfront, LOHAS Park", nature: "Leisure", time: 50, length: "9.6 km", difficulty: 4.5, image: "images/935.jpg", description: "A long-distance route for leisure and cycling training. Starting from the southernmost Innovation Hub, head north along the LOHAS Park waterfront and Po Hong Road, through TKO North to TKO Village at the northernmost end, for an open and exhilarating ride.", tags: ["Tseung Kwan O", "Leisure", "Long Distance", "Waterfront", "Training", "N-S Route", "Innovation Hub"], color: "#38761d", gpx: [{ label: "To Po Lam", file: "935寶琳.gpx" }, { label: "To Innovation Hub", file: "935創新園.gpx" }] },
        { id: 'X935', alias: "N–S Express", start: "Po Lam (TKO Village)", end: "TKO Innovation Hub", via: "Po Lam North Road, LOHAS Park", nature: "Leisure", time: 40, length: "8.0 km", difficulty: 4, image: "images/X935.jpg", description: "The express version of 935, taking a more direct path without the main line's detours. A long-distance leisure route with great conditions, letting you traverse TKO from north to south in less time.", tags: ["Tseung Kwan O", "Leisure", "Express", "Long Distance", "Waterfront", "Innovation Hub", "N-S Route"], color: "#38761d", gpx: [{ label: "To Po Lam", file: "X935寶琳.gpx" }, { label: "To Innovation Hub", file: "X935創新園.gpx" }] },
        { id: '939', alias: "Innovation Hub Explorer", start: "Tsun Ying", end: "TKO Innovation Hub", via: "Environmental Avenue", nature: "Leisure", time: 30, length: "2.5 km (one way)", difficulty: 3.5, image: "images/939.jpg", description: "A route connecting Tsun Ying and TKO Innovation Hub. Great for beginner cyclists looking for a relaxed experience in the area — with very few other cyclists around.", tags: ["Tseung Kwan O", "Leisure", "Flat", "Beginner Friendly", "Innovation Hub", "Quiet", "Loop"], color: "#741b47", gpx: [{ label: "Return", file: "939循環.gpx" }] },
        { id: '939M', alias: "LOHAS–Innovation Express", start: "LOHAS Park Station", end: "TKO Innovation Hub", via: "Environmental Avenue", nature: "Commute", time: 35, length: "2.9 km (one way)", difficulty: 3.5, image: "images/939M.jpg", description: "A fast commuter route connecting LOHAS Park Station and the Innovation Hub. Flat terrain designed for commuters, letting you quickly transfer to the MTR from the Innovation Hub.", tags: ["Tseung Kwan O", "Commuter", "Flat", "Fast", "Innovation Hub", "MTR Connection", "Quiet", "Loop"], color: "#741b47", gpx: [{ label: "To LOHAS Park", file: "939M康城.gpx" }, { label: "To Innovation Hub", file: "939M循環.gpx" }] },
        { id: '955', alias: "Po Lam Loop", start: "Po Lam (New Town Plaza II)", end: null, via: "Po Shun Road, Po Hong Road, Po Lam North Road", nature: "General", time: 20, length: "4.1 km", difficulty: 2, image: "images/955.jpg", description: "A loop connecting New Town Plaza II (Po Lam Station) and various parts of Po Lam. Suitable for both commuting and leisure, and convenient for connecting to other transport.", tags: ["Tseung Kwan O", "Flat", "Loop", "MTR Connection", "Bus Terminal"], color: "#dd7e6b", gpx: [{ label: "Clockwise", file: "955順時針.gpx" }, { label: "Anti-clockwise", file: "955逆時針.gpx" }] },
        { id: '955A', alias: "TKO Village Line", start: "TKO Village", end: "New Town Plaza II", via: "Po Lam North Road", nature: "Commute", time: 6, length: "1.2 km", difficulty: 1, image: "images/955A.jpg", description: "A fast commuter route from TKO Village directly to New Town Plaza II (Po Lam Station). Few slopes and convenient connections — the full journey takes just 6 minutes.", tags: ["Tseung Kwan O", "Commuter", "Fast", "Few Slopes", "MTR Connection"], color: "#dd7e6b", gpx: [{ label: "One-way", file: "955A將軍澳村.gpx" }] },
        { id: '955H', alias: "Spirit of Holy Express", start: "Po Lam Station", end: "Spirit of Holy Hospital (KMB Depot)", via: "", nature: "Mixed", time: "20 (return)", length: "3.1 km (return)", difficulty: 1.5, image: "images/955H.jpg", description: "A flat express route connecting Po Lam Station and Spirit of Holy Hospital. Suitable for both commuting and leisure, providing a convenient option for those needing to visit the hospital.", tags: ["Tseung Kwan O", "Flat", "Hospital", "MTR Connection", "Commute", "Leisure"], color: "#dd7e6b", gpx: [{ label: "Return", file: "955H循環.gpx" }] },
        { id: '960', alias: "Ultimate Tour Route", start: "TKO Village", end: "TKO Innovation Hub", via: "Po Lam North Road, Po Shun Road, Tseung Kwan O Station, Cross-Bay Bridge, LOHAS Park", nature: "Leisure", time: 80, length: "12.8 km", difficulty: 5, image: "images/960.jpg", description: "The ultimate tour route, covering most of Tseung Kwan O. Starting from Po Lam, passing through Hang Hau, Sheung Tak, Tseung Kwan O West and then crossing the Cross-Bay Bridge to LOHAS Park before reaching the Innovation Hub — the hilly sections are ideal for professional cycling training.", tags: ["Tseung Kwan O", "Leisure", "Training", "Hilly", "Long Distance", "Bridge Express", "N-S Route", "Innovation Hub", "Scenic", "Challenge"], color: "#76a5af", gpx: [{ label: "To Innovation Hub", file: "960創新園.gpx" }, { label: "To Po Lam", file: "960寶琳.gpx" }] },
        { id: '961', alias: "Baycrest–LOHAS Link", start: "Baycrest", end: "LOHAS Park West", via: "Tseung Kwan O Station, Tong Yin Street, Chi Sin Street, Yi Ming Estate, North Bridge, LOHAS Park Waterfront", nature: "Mixed", time: 30, length: "4.7 km", difficulty: 3, image: "images/961.jpg", description: "A fast-track route connecting LOHAS Park and Baycrest in Tseung Kwan O. With few slopes, LOHAS Park residents can conveniently reach TKO's central areas.", tags: ["Tseung Kwan O", "Few Slopes", "Baycrest Line", "Scenic", "Commute", "Leisure"], color: "#93c47d", gpx: [{ label: "To LOHAS Park", file: "961康城.gpx" }, { label: "To Tseung Kwan O", file: "961調景嶺.gpx" }] },
        { id: '961P', alias: "LOHAS Sunset Ride", start: "LOHAS Park West", end: "TKO Centre", via: "LOHAS Park Waterfront, South Bridge, TKO South Terrace", nature: "Leisure", time: 20, length: "3.0 km", difficulty: 3, image: "images/961P.jpg", description: "A one-way ride available only around sunset. Starting near the bridge in LOHAS Park, pass through the South Bridge and TKO South Terrace to reach TKO Centre — enjoy sunset views along the waterfront, then visit TKO's shopping centres or connect to a ferry.", tags: ["Tseung Kwan O", "Leisure", "Sunset", "One-way", "Waterfront", "Ferry", "Fast"], color: "#93c47d", gpx: [{ label: "One-way", file: "961P將軍澳.gpx" }] },
        { id: '962', alias: "Innovation Hub–City Centre", start: "TKO Innovation Hub", end: null, via: "Tseung Kwan O Station, TKO (Immigration Tower/MTR Station/Tong Yin Street)", nature: "Mixed", time: 60, length: "9.4 km", difficulty: 4, image: "images/962.jpg", description: "The fastest way to reach TKO Innovation Hub from TKO City Centre. Crossing the Cross-Bay Bridge, this is ideal for commuters who need to get there quickly.", tags: ["Tseung Kwan O", "Hilly", "Express", "Bridge Express", "Innovation Hub", "Quiet", "Commute", "Leisure"], color: "#c27ba0", gpx: [{ label: "Return", file: "962.gpx" }] },
        { id: '962A', alias: "Bridge Loop", start: "Tsun Ying", end: null, via: "TKO (Immigration Tower/MTR Station/Waterfront)", nature: "Mixed", time: 50, length: "9.4 km", difficulty: 4, image: "images/962A.jpg", description: "A loop between LOHAS Park / Tsun Ying and TKO City Centre or the Waterfront. The route design lets you enjoy both the Cross-Bay Bridge and the TKO Waterfront scenery.", tags: ["Tseung Kwan O", "Loop", "Hilly", "Express", "Waterfront", "Bridge Express", "Ferry", "Scenic", "Commute", "Leisure"], color: "#c27ba0", gpx: [{ label: "Loop", file: "962A循環.gpx" }] },
        { id: '962P', alias: "Innovation Hub Commuter", start: "TKO Innovation Hub", end: "Tseung Kwan O Station", via: "TKO South", nature: "Commute", time: 30, length: "5.7 km", difficulty: 3.5, image: "images/962P.jpg", description: "A one-way express route for TKO City Centre residents commuting from the Innovation Hub on weekday afternoons. Head directly from the Innovation Hub to TKO City via the bridge, bypassing Tseung Kwan O Station for speed.", tags: ["Tseung Kwan O", "Commuter", "One-way", "Hilly", "Express", "Bridge Express", "Innovation Hub"], color: "#c27ba0", gpx: [{ label: "One-way", file: "962P將軍澳.gpx" }] },
        { id: '962X', alias: "Immigration Tower Express", start: "Tsun Ying", end: "Tseung Kwan O Station", via: "LOHAS Park, Cross-Bay Bridge, TKO Immigration Tower", nature: "Commute", time: 20, length: "4.3 km", difficulty: 3.5, image: "images/962X.jpg", description: "A fast-track route for LOHAS Park residents commuting to TKO Immigration Tower or TKO City Centre office on weekday mornings. Cross the Cross-Bay Bridge from LOHAS Park to the Immigration Tower and Tseung Kwan O Station — time-efficient.", tags: ["Tseung Kwan O", "Commuter", "LOHAS Park", "One-way", "Hilly", "Express", "Bridge Express"], color: "#c27ba0", gpx: [{ label: "One-way", file: "962X康城.gpx" }] },
        { id: '966', alias: "Cross-Bay Bridge Route", start: "Baycrest", end: "LOHAS Park Station", via: "Tseung Kwan O Station, Cross-Bay Bridge", nature: "Mixed", time: 18, length: "3.2 km", difficulty: 3.5, image: "images/966.jpg", description: "A fast-track route connecting LOHAS Park Station and Tseung Kwan O Station / Baycrest, crossing the iconic Cross-Bay Bridge for a quick and scenic crossing. Suitable for both commuting and leisure.", tags: ["Tseung Kwan O", "Hilly", "Bridge Express", "LOHAS Park Line", "Baycrest Line", "Commute", "Leisure"], color: "#ff9900", gpx: [{ label: "To LOHAS Park", file: "966康城.gpx" }, { label: "To Tseung Kwan O", file: "966調景嶺.gpx" }] },
        { id: '966A', alias: "LOHAS Commuter A", start: "LOHAS Park Station", end: "Tseung Kwan O Station", via: "Cross-Bay Bridge", nature: "Commute", time: 15, length: "2.9 km", difficulty: 3, image: "images/966A.jpg", description: "A fast commuter route connecting LOHAS Park Station (LOHAS Park) and Tseung Kwan O Station via the Cross-Bay Bridge, making it easy for LOHAS Park residents to reach Tseung Kwan O or transfer to the MTR.", tags: ["Tseung Kwan O", "Commuter", "Hilly", "Bridge Express", "MTR Connection", "Bus Terminal", "LOHAS Park"], color: "#ff9900", gpx: [{ label: "To LOHAS Park", file: "966A康城.gpx" }, { label: "To Tseung Kwan O", file: "966A調景嶺.gpx" }] },
        { id: '966B', alias: "LOHAS Commuter B", start: "LOHAS Park Lido", end: "Tseung Kwan O Station", via: "Cross-Bay Bridge", nature: "Commute", time: 18, length: "3.3 km", difficulty: 3.5, image: "images/966B.jpg", description: "A fast commuter route connecting LOHAS Park Lido and Tseung Kwan O Station via the Cross-Bay Bridge, making it easy for LOHAS Park residents to reach Tseung Kwan O or transfer to the MTR.", tags: ["Tseung Kwan O", "Commuter", "Hilly", "Bridge Express", "MTR Connection", "Bus Terminal", "LOHAS Park"], color: "#ff9900", gpx: [{ label: "To LOHAS Park", file: "966B康城.gpx" }, { label: "To Tseung Kwan O", file: "966B調景嶺.gpx" }] },
        { id: '966C', alias: "LOHAS Commuter C", start: "Tsun Ying", end: "Tseung Kwan O Station", via: "LOHAS Park, Cross-Bay Bridge", nature: "Commute", time: 22, length: "3.8 km", difficulty: 4, image: "images/966C.jpg", description: "A fast commuter route connecting Tsun Ying / LOHAS Park and Tseung Kwan O Station via the Cross-Bay Bridge, making it easy for Tsun Ying and LOHAS Park residents to reach Tseung Kwan O or transfer to the MTR.", tags: ["Tseung Kwan O", "Commuter", "Hilly", "Bridge Express", "MTR Connection", "Bus Terminal", "LOHAS Park"], color: "#ff9900", gpx: [{ label: "To LOHAS Park", file: "966C康城.gpx" }, { label: "To Tseung Kwan O", file: "966C調景嶺.gpx" }] },
        { id: '966T', alias: "Bridge Tour Route", start: "Tseung Kwan O Station", end: "LOHAS Park Station", via: "Cross-Bay Bridge", nature: "Leisure", time: 16, length: "3.0 km", difficulty: 3, image: "images/966T.jpg", description: "An express bridge route designed for sightseeing. Connecting LOHAS Park Station and Tseung Kwan O Station, this is great for beginner cyclists looking to challenge themselves and enjoy the bridge scenery.", tags: ["Tseung Kwan O", "Leisure", "Hilly", "Bridge Express", "Beginner Friendly", "MTR Connection"], color: "#ff9900", gpx: [{ label: "To LOHAS Park", file: "966T康城.gpx" }, { label: "To Tseung Kwan O", file: "966T調景嶺.gpx" }] },
        { id: 'S90', alias: "LOHAS Park Waterfront Line", start: "Clear Water Bay Peninsula", end: null, via: "LOHAS Park Waterfront", nature: "Commute", time: 20, length: "3.5 km (return)", difficulty: 2.5, image: "images/S90.jpg", description: "The Clear Water Bay Peninsula dedicated line, connecting Tseung Kwan O Station. Few slopes suitable for commuting, providing residents with a fast MTR connection option.", tags: ["Tseung Kwan O", "Commuter", "Few Slopes", "Express", "CWB Peninsula", "MTR Connection"], color: "#00ff00", textColor: "black", gpx: [{ label: "Return", file: "S90康城循環.gpx" }] },
        { id: 'S91', alias: "CWB Peninsula Link", start: "Clear Water Bay Peninsula", end: "Tseung Kwan O Station", via: "North Bridge, Yi Ming Estate", nature: "Mixed", time: 6, length: "1.1 km", difficulty: 1, image: "images/S91.jpg", description: "A loop between Clear Water Bay Peninsula and LOHAS Park Station. Ideal for CWB Peninsula residents commuting, or for experiencing the LOHAS Park waterfront — flat terrain for easy cycling.", tags: ["Tseung Kwan O", "Flat", "Loop", "CWB Peninsula", "Commute", "Leisure"], color: "#ffff00", textColor: "black", gpx: [{ label: "To CWB Peninsula", file: "S91清水灣半島.gpx" }, { label: "To Tseung Kwan O", file: "S91調景嶺.gpx" }] },
        { id: 'ST01', alias: "Sha Tin (Coming Soon)", start: "Sha Tin Station", end: "City One", via: "Shing Mun River Promenade", nature: "Commute", time: "TBC", length: "TBC", difficulty: "TBC", image: "images/st_coming_soon.jpg", description: "A planned Sha Tin route — stay tuned!", tags: ["Sha Tin", "Commute"], color: "#333", link: "/coming_soon.html", gpx: [] }
    ];

    /**
     * 英文版路線詳情頁初始化 (English route detail page)
     */
    function initEnRouteDetailPage() {
        const routeDetailContainer = document.getElementById('route-detail-container');
        if (!routeDetailContainer) return;

        const urlParams = new URLSearchParams(window.location.search);
        const routeId = urlParams.get('id');

        if (routeId) {
            const route = enRoutes.find(r => r.id === routeId);
            if (route) {
                document.title = `City Transport Cycle - ${route.alias || route.id}`;
                let gpxButtonsHtml = '';
                if (route.gpx && route.gpx.length > 0) {
                    const isSenior = (() => {
                        try {
                            const userData = localStorage.getItem('user');
                            if (!userData) return false;
                            const user = JSON.parse(userData);
                            return user.user_role === 'senior' || user.role === 'senior';
                        } catch (e) { return false; }
                    })();

                    if (isSenior) {
                        gpxButtonsHtml = `
                            <div class="gpx-download-container">
                                ${route.gpx.map(gpxFile => `
                                    <a href="/gpx/${gpxFile.file}" download="${gpxFile.file}" class="gpx-download-button">
                                        ${gpxFile.label} <i class="fas fa-download"></i>
                                    </a>
                                `).join('')}
                            </div>
                        `;
                    } else {
                        const isLoggedInUser = !!localStorage.getItem('accessToken');
                        const lockMsg = isLoggedInUser
                            ? 'Upgrade to Senior Membership to download GPX route files'
                            : 'Sign in and become a Senior Member to download GPX route files';
                        gpxButtonsHtml = `
                            <div class="gpx-download-container">
                                <div class="gpx-locked-notice" style="background:#f5f5f5; border:1px solid #ddd; border-radius:8px; padding:1em; text-align:center; margin-top:1em;">
                                    <i class="fas fa-lock" style="color:#999; font-size:1.5em; display:block; margin-bottom:0.5em;"></i>
                                    <p style="color:#666; margin:0 0 0.8em;">${lockMsg}</p>
                                    ${isLoggedInUser
                                        ? `<a href="/profile-setup" class="cta-button" style="font-size:0.85em; padding:0.5em 1.2em;">Upgrade Membership</a>`
                                        : `<a href="/login" class="cta-button" style="font-size:0.85em; padding:0.5em 1.2em;">Sign In</a>`
                                    }
                                </div>
                            </div>
                        `;
                    }
                }
                const difficultyDisplay = (route.difficulty === 'TBC') ? 'TBC' : `${generateStarRating(route.difficulty)} (${route.difficulty}/5)`;
                routeDetailContainer.innerHTML = `
                    <div class="route-hero animated-element" style="background-color: ${route.color}; color: ${route.textColor || 'white'};">
                        <h1 class="route-hero-title">${route.alias || 'Route Detail'}</h1>
                        <p class="route-id-text">Route Number: ${route.id}</p>
                    </div>
                    <div class="route-detail-grid animated-element">
                        <div class="route-image-container">
                            <img src="/${route.image}" alt="${route.alias || route.id}" class="route-detail-image">
                            ${gpxButtonsHtml}
                        </div>
                        <div class="route-detail-info">
                            <p class="route-description">${route.description}</p>
                            <div class="route-stats">
                                <div><strong>Start:</strong> ${route.start}</div>
                                <div><strong>End:</strong> ${route.end || 'Loop Route'}</div>
                                <div><strong>Via:</strong> ${route.via || '—'}</div>
                                <div><strong>Type:</strong> ${route.nature}</div>
                                <div><strong>Est. Journey Time:</strong> ${route.time} min</div>
                                <div><strong>Route Length:</strong> ${route.length}</div>
                                <div><strong>Difficulty:</strong> ${difficultyDisplay}</div>
                            </div>
                            <div class="route-tags-container">
                                <strong>Tags:</strong>
                                <div class="route-tags">
                                    ${route.tags.map(tag => `<span class="route-tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                initAnimatedElements();
            } else {
                routeDetailContainer.innerHTML = '<p>Route not found.</p>';
            }
        }
    }

    // =========================================================================
    // 執行初始化 (你原有的程式碼)
    // =========================================================================
    if (document.getElementById('routes-preview-container')) {
        initHomePage();
    }
    if (document.getElementById('en-routes-preview-container')) {
        initEnHomePage();
    }
    if (document.getElementById('all-routes-container')) {
        initRoutesPage();
    }
    if (document.getElementById('route-detail-container')) {
        // 根據路徑判斷使用中文還是英文版本的路線詳情
        if (window.location.pathname.startsWith('/en/')) {
            initEnRouteDetailPage();
        } else {
            initRouteDetailPage();
        }
    }
    // 網誌頁面現已改為從 /api/blog 動態載入，不再使用硬編碼資料
    // blog.html 和 blog_post.html 包含自己的 API 載入邏輯

    initAnimatedElements();

    // 呼叫載入共用元件的函式
    loadSharedComponents(); // 這裡會觸發 updateNavUI

    // =========================================================================
    // 其他全域腳本 (Dark mode, Modal 等) (你原有的程式碼)
    // =========================================================================

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    });

    const modal = document.getElementById('notificationModal');

    function closeNotification() {
        if (!modal) return;
        const modalContent = modal.querySelector('.bg-white, .bg-gray-800');
        modalContent.classList.remove('modal-enter');
        modalContent.classList.add('modal-exit');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);
    }

    function showNotification() {
        if (!modal) return;
        modal.style.display = 'flex';
        const modalContent = modal.querySelector('.bg-white, .bg-gray-800');
        modalContent.classList.remove('modal-exit');
        modalContent.classList.add('modal-enter');
    }

    function initializeNotificationModal() {
        if (!modal) return;
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeNotification();
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeNotification();
            }
        });
        window.addEventListener('load', function() {
            setTimeout(() => {
                showNotification();
            }, 500);
        });
    }

    initializeNotificationModal();

    const NotificationManager = {
        showSuccess: function(title, message) { console.log('Success notification:', title, message); },
        showWarning: function(title, message) { console.log('Warning notification:', title, message); },
        showError: function(title, message) { console.log('Error notification:', title, message); },
        setDismissed: function(notificationId) { console.log(`Notification ${notificationId} dismissed`); },
        isDismissed: function(notificationId) { return false; }
    };

    window.closeNotification = closeNotification;
    window.showNotification = showNotification;
    window.NotificationManager = NotificationManager;

    // ------------------- 所有程式碼都在這裡結束 -------------------
});
