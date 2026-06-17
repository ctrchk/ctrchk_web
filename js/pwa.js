// js/pwa.js — CTRC HK PWA 輔助功能
// 負責：Service Worker 註冊、安裝提示、推送通知、GPS 狀態顯示、SPA 路由
// Phase 1: PWA / Web separation — .app-only elements visible only in app,
//          .web-only elements visible only in browser.

(function () {
  'use strict';

  // ── Permission context (Mileage rank) ───────────────────────────────────
  const MILEAGE_RANKS = ['bronze', 'silver', 'gold'];
  const PERMISSION_DEFS = [
    { id: 1, key: 'nav_2d_basic', rank: 'bronze', label: '基礎 2D 單車徑導航' },
    { id: 2, key: 'ride_basic_stats', rank: 'bronze', label: '基礎個人騎行與連勝數據紀錄' },
    { id: 3, key: 'weather_basic', rank: 'bronze', label: '即時天氣資訊入口' },
    { id: 4, key: 'poster_basic', rank: 'bronze', label: '騎行戰績海報（標準版）' },
    { id: 5, key: 'discord_basic', rank: 'bronze', label: 'Discord 基礎頻道訪問權' },
    { id: 6, key: 'reward_variable', rank: 'bronze', label: '騎行完成隨機獎勵（XP/里程幣）' },
    { id: 7, key: 'map_cycparkspace', rank: 'bronze', label: 'CYCPARKSPACE 單車泊位圖層' },
    { id: 8, key: 'theme_silver', rank: 'silver', label: '銀卡專屬介面主題' },
    { id: 9, key: 'nav_multistop', rank: 'silver', label: '多站點自訂路線規劃（最多 5 站）' },
    { id: 10, key: 'weather_heavy_rain_alert', rank: 'silver', label: '惡劣天氣提醒（規劃中）' },
    { id: 11, key: 'poster_no_watermark', rank: 'silver', label: '高清海報（減少水印）' },
    { id: 12, key: 'coin_bonus_silver', rank: 'silver', label: '里程幣收益永久加成 +5%' },
    { id: 13, key: 'map_issue_report', rank: 'silver', label: '路面維修/障礙標記權' },
    { id: 14, key: 'weekly_efficiency_report', rank: 'silver', label: '週度騎行效率分析（規劃中）' },
    { id: 15, key: 'discord_silver_role', rank: 'silver', label: 'Discord「銀色破風手」身分組' },
    { id: 16, key: 'map_3d_gold', rank: 'gold', label: '進階地圖視覺（規劃中）' },
    { id: 17, key: 'theme_gold', rank: 'gold', label: '金卡專屬介面主題' },
    { id: 18, key: 'poster_gold_copy', rank: 'gold', label: '海報進階文案樣式' },
    { id: 19, key: 'coin_bonus_gold', rank: 'gold', label: '里程幣收益永久加成 +15%' },
    { id: 20, key: 'route_naming_rights', rank: 'gold', label: '路線建議命名提案（提交審核）' },
    { id: 21, key: 'weather_radar_5min', rank: 'gold', label: '5 分鐘降雨雷達（規劃中）' },
    { id: 22, key: 'beta_priority', rank: 'gold', label: '新功能 Beta 優先體驗' },
    { id: 23, key: 'discord_emergency', rank: 'gold', label: '客服快速協助通道（規劃中）' },
    { id: 24, key: 'weekend_double_preview', rank: 'gold', label: '週末雙倍里程活動優先通知' },
    { id: 25, key: 'discord_gold_role', rank: 'gold', label: 'Discord「黃金領騎」稱號及身份組' },
  ];

  function normalizeRank(rankInput) {
    const raw = String(rankInput || '').toLowerCase();
    if (raw.includes('gold') || raw.includes('金')) return 'gold';
    if (raw.includes('silver') || raw.includes('銀')) return 'silver';
    if (raw.includes('bronze') || raw.includes('銅')) return 'bronze';
    return 'bronze';
  }

  function buildPermissionContext(rankInput) {
    const rank = normalizeRank(rankInput);
    const rankIndex = MILEAGE_RANKS.indexOf(rank);
    const permissions = {};
    const list = PERMISSION_DEFS.map((def) => {
      const enabled = rankIndex >= MILEAGE_RANKS.indexOf(def.rank);
      permissions[def.key] = enabled;
      return Object.assign({}, def, { enabled });
    });
    return { rank, permissions, list };
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function resolvePermissionContext() {
    const user = getStoredUser() || {};
    const rank = user.permission_rank || user.mileage_rank || user.mileage_card || 'bronze';
    return buildPermissionContext(rank);
  }

  function applyMembershipTheme(context) {
    if (!document.body || !context) return;
    if (!isStandalone) {
      document.body.classList.remove('rank-silver', 'rank-gold');
      return;
    }
    const rank = String(context.rank || '').toLowerCase();
    const silverEnabled = localStorage.getItem('silverThemeDisabled') !== '1';
    const goldEnabled = localStorage.getItem('goldThemeDisabled') !== '1';
    document.body.classList.remove('rank-silver', 'rank-gold');
    if (rank === 'gold' && context.permissions.theme_gold && goldEnabled) {
      document.body.classList.add('rank-gold');
      // When gold theme is active, force dark mode
      const currentTheme = localStorage.getItem('appTheme');
      if (currentTheme !== 'dark') {
          localStorage.setItem('appTheme', 'dark');
      }
      document.body.classList.add('app-theme-explicit');
      document.body.classList.remove('app-light-theme');
    } else {
        // Restore theme if gold theme is NOT active
        const storedTheme = localStorage.getItem('appTheme');
        if (storedTheme === 'light') {
            document.body.classList.add('app-theme-explicit', 'app-light-theme');
        } else if (storedTheme === 'dark') {
            document.body.classList.add('app-theme-explicit');
            document.body.classList.remove('app-light-theme');
        }
    }

    if (rank === 'silver' && context.permissions.theme_silver && silverEnabled) {
      document.body.classList.add('rank-silver');
    }
  }
  function refreshMembershipTheme() {
    window.CTRCHK_PERMISSION_CONTEXT = resolvePermissionContext();
    applyMembershipTheme(window.CTRCHK_PERMISSION_CONTEXT);
  }

  window.CTRCHK_PERMISSION_DEFS = PERMISSION_DEFS;
  window.CTRCHK_PERMISSION_CONTEXT = resolvePermissionContext();
  window.getPermissionContext = resolvePermissionContext;
  window.refreshMembershipTheme = refreshMembershipTheme;
  window.hasPermission = function (key) {
    const ctx = window.CTRCHK_PERMISSION_CONTEXT || resolvePermissionContext();
    return !!(ctx.permissions && ctx.permissions[key]);
  };

  /**
   * 根據等級獲取車手稱號
   * @param {number} level
   * @returns {string}
   */
  window.getCyclistTier = function (level) {
    const lv = parseInt(level || 1, 10);
    if (lv >= 76) return '頂尖車手';
    if (lv >= 51) return '精英車手';
    if (lv >= 31) return '資深車手';
    if (lv >= 16) return '進階車手';
    if (lv >= 6) return '初階車手';
    return '入門車手';
  };

  // ── Detect standalone (installed PWA) mode ──────────────────────────────
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.location.search.includes('pwa=true');
  window.CTRCHK_IS_STANDALONE = isStandalone;

  if (isStandalone) {
    if (document.body) {
      document.body.classList.add('is-pwa');
    }
  }

  // ── Service Worker 註冊 ─────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker 已註冊:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 註冊失敗:', err);
        });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        if (!sessionStorage.getItem('sw-reloaded')) {
          sessionStorage.setItem('sw-reloaded', '1');
          const toast = document.createElement('div');
          toast.textContent = '✨ 新版本已準備好，正在更新...';
          toast.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:5.8em;z-index:2000;background:#6dba65;color:#121f14;padding:0.55em 1em;border-radius:999px;font-size:0.82em;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.3);';
          document.body.appendChild(toast);
          setTimeout(() => window.location.reload(), 700);
        }
      }
    });
  }

  // ── App bottom navigation bar ───────────────────────────────────────────
  function injectAppBottomNav() {
    if (document.getElementById('app-bottom-nav')) return;

    const isEn = window.location.pathname.startsWith('/en') ||
                 document.documentElement.lang === 'en' ||
                 localStorage.getItem('appLang') === 'en';

    const isLoggedIn = !!localStorage.getItem('accessToken');

    const links = isEn
      ? [
          { href: '/en',        icon: 'fa-home',            label: 'Home' },
          { href: '/tasks',     icon: 'fa-tasks',            label: 'Tasks' },
          { href: '/en/routes', icon: 'fa-biking',           label: 'Ride' },
          { href: '/nav',       icon: 'fa-map-marked-alt',   label: 'Nav' },
          isLoggedIn
            ? { href: '/dashboard', icon: 'fa-user-circle', label: 'My' }
            : { href: '/login',   icon: 'fa-sign-in-alt',  label: 'Sign In' },
        ]
      : [
          { href: '/',             icon: 'fa-home',            label: '主頁' },
          { href: '/tasks',        icon: 'fa-tasks',            label: '任務' },
          { href: '/routes',       icon: 'fa-biking',           label: '騎行' },
          { href: '/nav',          icon: 'fa-map-marked-alt',   label: '導航' },
          isLoggedIn
            ? { href: '/dashboard',      icon: 'fa-user-circle', label: '我的' }
            : { href: '/login',        icon: 'fa-sign-in-alt',  label: '登入' },
        ];

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    const nav = document.createElement('nav');
    nav.id = 'app-bottom-nav';
    nav.setAttribute('aria-label', isEn ? 'App navigation' : 'App 導航');

    links.forEach(({ href, icon, label }) => {
      const a = document.createElement('a');
      a.href = href;
      const normalised = href.replace(/\/$/, '') || '/';
      if (currentPath === normalised || (normalised !== '/' && currentPath.startsWith(normalised))) {
        a.classList.add('active');
      }
      a.innerHTML = `<i class="fas ${icon}"></i><span>${label}</span>`;
      nav.appendChild(a);
    });

    document.body.appendChild(nav);
  }

  // ── SPA Router for PWA Mode ──────────────────────────────────────────────
  const PWA_PAGES = {
    '/': { id: 'pwa-page-home', title: '主頁' },
    '/tasks': { id: 'pwa-page-tasks', title: '任務' },
    '/routes': { id: 'pwa-page-routes', title: '騎行' },
    '/ride': { id: 'pwa-page-ride', title: '騎行中' },
    '/nav': { id: 'pwa-page-nav', title: '導航' },
    '/dashboard': { id: 'pwa-page-dashboard', title: '我的' },
    '/history': { id: 'pwa-page-history', title: '騎行紀錄' },
  };

  const pageContainers = new Map();

  function getNormalizedPath(path) {
    let p = path.split('?')[0].split('#')[0].replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (p.startsWith('/en/')) p = p.replace('/en', '') || '/';
    return p;
  }

  function initPWAShell() {
    if (!isStandalone) return;

    let shell = document.getElementById('pwa-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'pwa-shell';

      const initialPath = getNormalizedPath(window.location.pathname);
      const config = PWA_PAGES[initialPath] || { id: 'pwa-page-other', title: document.title };

      const container = document.createElement('div');
      container.id = config.id;
      container.className = 'pwa-page-container active';
      pageContainers.set(initialPath, container);

      const appElements = document.querySelectorAll('main, #app-home, #app-ride-page, .tasks-container, .db-content, #map, #ride-map, .hud-container, .setup-panel, .floating-controls, #ride-top, #next-stop-card, #ride-bottom-sheet');
      appElements.forEach(el => container.appendChild(el));

      shell.appendChild(container);
      document.body.prepend(shell);
    }

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      const path = getNormalizedPath(url.pathname);
      if (PWA_PAGES[path]) {
        e.preventDefault();
        navigateTo(url.pathname + url.search + url.hash);
      }
    });

    window.addEventListener('popstate', (e) => {
      const path = window.location.pathname;
      navigateTo(path, { pushState: false });
    });

    window.navigateTo = navigateTo;
  }

  window.PWA_MAPS_INITED = window.PWA_MAPS_INITED || new Set();

  async function navigateTo(path, { pushState = true } = {}) {
    const normalizedPath = getNormalizedPath(path);
    const config = PWA_PAGES[normalizedPath];

    if (!config) {
      if (pushState) window.location.href = path;
      return;
    }

    if (pushState) {
      window.history.pushState({}, '', path);
    }

    let targetContainer = pageContainers.get(normalizedPath);
    if (!targetContainer) {
      targetContainer = await fetchPage(path);
    }

    console.log('[PWA-SPA] Navigating to:', normalizedPath);
    if (targetContainer) {
      document.querySelectorAll('.pwa-page-container').forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
      });
      targetContainer.classList.add('active');
      targetContainer.style.display = 'block';

      if (config.title) document.title = config.title;

      if (normalizedPath === '/nav' || normalizedPath === '/ride') {
        document.body.classList.add('is-navigating');
      } else {
        document.body.classList.remove('is-navigating');
      }

      const bottomNav = document.getElementById('app-bottom-nav');
      if (bottomNav) {
        bottomNav.querySelectorAll('a').forEach(a => {
          const aPath = getNormalizedPath(new URL(a.href, window.location.origin).pathname);
          a.classList.toggle('active', aPath === normalizedPath);
        });
      }

      window.dispatchEvent(new CustomEvent('pwa-page-show', { detail: { path: normalizedPath } }));
      window.scrollTo(0, 0);
    }
  }

  const loadingPages = new Map();

  async function fetchPage(path) {
    const normalizedPath = getNormalizedPath(path);
    if (pageContainers.has(normalizedPath)) return pageContainers.get(normalizedPath);
    if (loadingPages.has(normalizedPath)) return loadingPages.get(normalizedPath);

    const loadPromise = (async () => {
    try {
      let fetchPath = path;
      if (!path.includes('.') && path !== '/') {
          fetchPath = path.split('?')[0].split('#')[0] + '.html';
          const search = path.includes('?') ? '?' + path.split('?')[1] : '';
          fetchPath += search;
      }

      const response = await fetch(fetchPath);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const config = PWA_PAGES[normalizedPath];
      const container = document.createElement('div');
      container.id = config.id;
      container.className = 'pwa-page-container';

      let content;
      if (normalizedPath === '/') content = doc.querySelector('#app-home') || doc.querySelector('main');
      else if (normalizedPath === '/routes') content = doc.querySelector('#app-ride-page');
      else if (normalizedPath === '/tasks') content = doc.querySelector('.tasks-container');
      else if (normalizedPath === '/dashboard') content = doc.querySelector('.db-content');
      else if (normalizedPath === '/history') content = doc.querySelector('#history-page-container');
      else if (normalizedPath === '/nav') {
          const navElements = doc.querySelectorAll('#map, .hud-container, .setup-panel, .floating-controls, #summary-modal, #loading-overlay, #resume-panel');
          const navWrap = document.createElement('div');
          navElements.forEach(el => navWrap.appendChild(el));
          content = navWrap;
      } else if (normalizedPath === '/ride') {
          const rideElements = doc.querySelectorAll('#ride-map, #ride-top, .hud-container, #next-stop-card, #free-mode-panel, #go-to-start-banner, #ride-bottom-sheet, #ride-summary, #ride-resume-modal, #ride-loading, #ride-locked');
          const rideWrap = document.createElement('div');
          rideElements.forEach(el => rideWrap.appendChild(el));
          content = rideWrap;
      }

      if (content) {
        container.appendChild(content);
        document.getElementById('pwa-shell').appendChild(container);
        pageContainers.set(normalizedPath, container);

        const styles = doc.querySelectorAll('style');
        styles.forEach(s => document.head.appendChild(s.cloneNode(true)));

        const scripts = doc.querySelectorAll('script');
        scripts.forEach(oldScript => {
          if (oldScript.src) {
              if (oldScript.src.includes('main.js') || oldScript.src.includes('pwa.js') ||
                  oldScript.src.includes('leaflet.js') || oldScript.src.includes('mapbox-gl.js')) return;

              const newScript = document.createElement('script');
              newScript.src = oldScript.src;
              newScript.async = false;
              document.body.appendChild(newScript);
          } else {
              let code = oldScript.textContent;
              // Replace DOMContentLoaded with a custom helper that runs immediately if we are in SPA
              code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"]\s*,\s*/g, 'window.onPWAReady(');

              const newScript = document.createElement('script');
              newScript.textContent = `(function(){\n${code}\n})();`;
              document.body.appendChild(newScript);
          }
        });

        return container;
      }
    } catch (e) {
      console.error('[PWA-SPA] Fetch failed for', path, e);
    } finally {
      loadingPages.delete(normalizedPath);
    }
    return null;
    })();

    loadingPages.set(normalizedPath, loadPromise);
    return loadPromise;
  }

  function prefetchPWAPages() {
    if (!isStandalone) return;
    const paths = Object.keys(PWA_PAGES);
    const current = getNormalizedPath(window.location.pathname);

    paths.forEach(path => {
      if (path !== current) {
        setTimeout(() => fetchPage(path), 1500);
      }
    });
  }

  // ── Initialise on DOM ready ───────────────────────────────────────────────
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  window.isSPA = () => isStandalone;
  window.onPWAReady = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  onReady(() => {
    if (isStandalone) {
      document.body.classList.add('is-pwa');
      initPWAShell();
      injectAppBottomNav();
      prefetchPWAPages();
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#121f14');
    }
    refreshMembershipTheme();
  });

  window.addEventListener('pageshow', refreshMembershipTheme);
  window.addEventListener('storage', (event) => {
    if (event.key === 'user' || event.key === 'silverThemeDisabled' || event.key === 'goldThemeDisabled') {
      refreshMembershipTheme();
    }
  });

  // ── 推送通知與簽到提醒 (保持不變) ──────────────────────────────────────────
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') subscribeToPush();
    return permission === 'granted';
  }

  function sendLocalNotification(title, body, tag) {
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/images/icon-192.png', tag: tag || 'ctrc-stop' });
  }

  function scheduleDailyCheckinReminder() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (localStorage.getItem('pushNotificationsDisabled') === '1' || localStorage.getItem('checkinReminderDisabled') === '1') return;

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    try {
      const checkins = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
      if (checkins[todayKey]) return;
    } catch (_) {}

    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    setTimeout(() => {
      sendLocalNotification('🗓️ 別忘了今日簽到！', '連續簽到可解鎖豐厚 XP 及里程幣獎勵，快來打卡吧！', 'ctrc-checkin-reminder');
      scheduleDailyCheckinReminder();
    }, target.getTime() - now.getTime());
  }

  window.addEventListener('load', () => {
    if (!localStorage.getItem('notifReset_v1')) {
      localStorage.removeItem('pushNotificationsDisabled');
      localStorage.setItem('notifReset_v1', '1');
    }
    if (localStorage.getItem('pushNotificationsDisabled') === '1') return;
    if ('Notification' in window && Notification.permission === 'granted') {
      subscribeToPush();
      scheduleDailyCheckinReminder();
    }
  });

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
    try {
      const keyRes = await fetch('/api/push');
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json();
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const token = localStorage.getItem('accessToken') || '';
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() }),
      });
    } catch (err) { console.warn('Push subscription failed:', err); }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  window.CTRCHK_PWA = {
    isStandalone,
    requestNotificationPermission,
    sendLocalNotification,
    scheduleDailyCheckinReminder,
    subscribeToPush,
  };
})();
