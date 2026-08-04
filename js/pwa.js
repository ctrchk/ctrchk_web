// js/pwa.js — CTRC HK PWA 輔助功能
// 負責：Service Worker 註冊、安裝提示、推送通知、GPS 狀態顯示
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
    { id: 8, key: 'theme_silver', rank: 'silver', label: '銀卡專屬介面主題與動態頭像框（銀白微發光圈）' },
    { id: 9, key: 'nav_multistop', rank: 'silver', label: '多站點自訂路線規劃（最多 5 站）' },
    { id: 10, key: 'weather_heavy_rain_alert', rank: 'silver', label: '惡劣天氣提醒與暴雨警告' },
    { id: 11, key: 'poster_no_watermark', rank: 'silver', label: '高清海報（減少水印）' },
    { id: 12, key: 'coin_bonus_silver', rank: 'silver', label: '里程幣收益永久加成 +5%' },
    { id: 13, key: 'map_issue_report', rank: 'silver', label: '路面障礙優先審核權' },
    { id: 14, key: 'monthly_ai_report', rank: 'silver', label: '每月份 AI 騎行簡報' },
    { id: 15, key: 'discord_silver_role', rank: 'silver', label: 'Discord「銀色破風手」身分組' },
    { id: 26, key: 'map_cycramp', rank: 'silver', label: '無障礙斜坡與Ramp圖層' },
    { id: 16, key: 'map_3d_gold', rank: 'gold', label: '進階地圖視覺' },
    { id: 17, key: 'theme_gold', rank: 'gold', label: '金卡專屬介面主題與 3D 黑曜石流金框' },
    { id: 18, key: 'poster_gold_copy', rank: 'gold', label: '海報進階文案樣式' },
    { id: 19, key: 'coin_bonus_gold', rank: 'gold', label: '里程幣收益永久加成 +15%' },
    { id: 20, key: 'route_naming_rights', rank: 'gold', label: '路線建議命名提案（提交審核）' },
    { id: 21, key: 'weather_radar_5min', rank: 'gold', label: '5 分鐘降雨雷達（規劃中）' },
    { id: 22, key: 'beta_priority', rank: 'gold', label: '新功能 Beta 優先體驗' },
    { id: 23, key: 'discord_emergency', rank: 'gold', label: '客服快速協助通道（規劃中）' },
    { id: 24, key: 'weekend_double_preview', rank: 'gold', label: '週末雙倍里程活動優先通知' },
    { id: 25, key: 'discord_gold_role', rank: 'gold', label: 'Discord「黃金領騎」稱號及身份組' },
    { id: 27, key: 'weekly_ai_report', rank: 'gold', label: '每星期 AI 深度教練總結' },
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
  // Chrome/Android: matchMedia('(display-mode: standalone)')
  // iOS Safari: navigator.standalone === true
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  window.CTRCHK_IS_STANDALONE = isStandalone;

  if (isStandalone) {
    // Apply to body once DOM is ready (body may not exist at script parse time).
    // The onReady() handler below does the definitive class addition; this is
    // an early hint for inline scripts that run before DOMContentLoaded.
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

    // 監聽 Service Worker 更新通知，自動重載頁面以載入最新版本
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        // 避免重複重載（同一頁面只重載一次）
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

  // ── App bottom navigation bar (injected only in standalone mode) ─────────
  function injectAppBottomNav() {
    if (document.getElementById('app-bottom-nav')) return; // already injected

    const isEn = window.location.pathname.startsWith('/en') ||
                 document.documentElement.lang === 'en' ||
                 localStorage.getItem('appLang') === 'en';

    const isLoggedIn = !!localStorage.getItem('accessToken');

    // New nav order: 主頁 | 任務 | 騎行 | 導航 | 我的
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

    // Animate active liquid bubble on load
    setTimeout(updateLiquidBubble, 50);
  }

  // ── SPA (Single Page Application) Keep-Alive Core ─────────────────────────
  const spaTabs = {}; // url -> { element: HTMLElement, type: 'native'|'iframe' }

  function initPwaSpaSystem() {
    if (!isStandalone) return;

    // Check if we are inside an iframe (child page of the SPA)
    if (window.parent !== window) {
      document.documentElement.classList.add('in-spa-iframe');
      document.body.classList.add('in-spa-iframe');

      // Intercept any clicks on main tab links inside the iframe and delegate to parent
      document.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (!a) return;

        const href = a.getAttribute('href');
        if (!href) return;

        // Handle only same-origin/internal links
        let targetUrl = href;
        if (href.startsWith('http://') || href.startsWith('https://')) {
          const urlObj = new URL(href);
          if (urlObj.origin === window.location.origin) {
            targetUrl = urlObj.pathname + urlObj.search + urlObj.hash;
          } else {
            return; // external
          }
        }

        const cleanUrl = targetUrl.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
        const mainTabs = ['/', '/index', '/tasks', '/routes', '/nav', '/dashboard', '/login', '/en', '/en/routes'];

        if (mainTabs.includes(cleanUrl)) {
          e.preventDefault();
          try {
            window.parent.switchToTab(targetUrl);
          } catch (err) {
            window.parent.location.href = targetUrl;
          }
        }
      });
      return; // child iframes do not need the shell logic below
    }

    // --- Parent (Shell) Logic ---
    const initialUrl = window.location.pathname.replace(/\/$/, '') || '/';

    // Create viewport container
    const viewport = document.createElement('div');
    viewport.id = 'spa-viewport';

    // Create initial native content wrapper
    const initialTab = document.createElement('div');
    initialTab.id = 'spa-tab-initial';
    initialTab.className = 'spa-tab-content active';
    initialTab.dataset.url = initialUrl;

    // Move existing body content into the initial native tab wrapper
    const children = Array.from(document.body.childNodes);
    children.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const id = child.id;
        const tag = child.tagName.toLowerCase();
        if (
          id === 'app-bottom-nav' ||
          id === 'app-splash' ||
          id === 'notificationModal' ||
          id === 'global-terms-agreement-modal' ||
          id === 'ctrchk-beta-welcome-modal' ||
          tag === 'script' ||
          tag === 'link' ||
          tag === 'style'
        ) {
          return; // preserve these elements in the parent root body
        }
      }
      initialTab.appendChild(child);
    });

    viewport.appendChild(initialTab);
    document.body.insertBefore(viewport, document.getElementById('app-bottom-nav'));

    // Register the initial tab as 'native' type so we don't reload it!
    spaTabs[initialUrl] = {
      element: initialTab,
      type: 'native'
    };

    // Expose switchToTab on parent window for children to call
    window.switchToTab = function(targetUrl, isPopState = false) {
      const cleanUrl = targetUrl.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';

      const activeTabEl = document.querySelector('.spa-tab-content.active');
      let targetTabObj = spaTabs[cleanUrl];

      // If we don't have this tab registered yet, dynamically create a Keep-Alive iframe
      if (!targetTabObj) {
        const iframeTab = document.createElement('div');
        iframeTab.className = 'spa-tab-content';
        iframeTab.dataset.url = cleanUrl;

        // Resolve Clean URLs (e.g. /tasks) to physical .html files for local servers
        let iframeSrc = targetUrl;
        const pathParts = cleanUrl.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && !lastPart.includes('.')) {
          const mainPages = ['/tasks', '/routes', '/nav', '/dashboard', '/login', '/en/routes', '/mileage', '/weather', '/chat', '/profile', '/leaderboard'];
          if (mainPages.includes(cleanUrl)) {
            iframeSrc = cleanUrl + '.html' + (targetUrl.includes('?') ? '?' + targetUrl.split('?')[1] : '');
          }
        }

        const iframe = document.createElement('iframe');
        iframe.src = iframeSrc;
        iframe.className = 'spa-page-iframe';
        iframe.style.cssText = 'width:100%; height:100%; border:none; display:block;';

        iframeTab.appendChild(iframe);
        document.getElementById('spa-viewport').appendChild(iframeTab);

        targetTabObj = {
          element: iframeTab,
          type: 'iframe',
          iframe: iframe
        };
        spaTabs[cleanUrl] = targetTabObj;
      }

      const targetTabEl = targetTabObj.element;
      if (activeTabEl === targetTabEl) return;

      // Animate transition between outgoing and incoming tabs (iOS 26 cinematic transition)
      if (activeTabEl) {
        activeTabEl.classList.remove('active');
        activeTabEl.classList.add('spa-tab-exit');
        activeTabEl.style.display = 'block';
        activeTabEl.style.zIndex = '5';
      }

      targetTabEl.style.display = 'block';
      targetTabEl.style.zIndex = '10';
      targetTabEl.classList.add('spa-tab-enter');

      // Trigger browser style recalculation
      targetTabEl.offsetHeight;

      targetTabEl.classList.add('active');

      setTimeout(() => {
        if (activeTabEl) {
          activeTabEl.style.display = 'none';
          activeTabEl.classList.remove('spa-tab-exit');
        }
        targetTabEl.classList.remove('spa-tab-enter');
      }, 380);

      // Update browser history/address bar URL (unless called from back/forward popstate)
      if (!isPopState) {
        history.pushState(null, '', targetUrl);
      }

      // Sync bottom navigation active states and bubble indicator
      updateAppBottomNavActiveState(cleanUrl);
    };

    // Listen to browser Back and Forward navigation events
    window.addEventListener('popstate', function() {
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;
      window.switchToTab(currentUrl, true);
    });

    // Intercept clicks on links globally
    document.addEventListener('click', function(e) {
      const a = e.target.closest('a');
      if (!a) return;

      const href = a.getAttribute('href');
      if (!href) return;

      // Internal links only
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const urlObj = new URL(href);
        if (urlObj.origin !== window.location.origin) {
          return; // external
        }
      }

      if (a.hasAttribute('download') || a.getAttribute('target') === '_blank') {
        return; // skip special behaviors
      }

      e.preventDefault();
      const targetUrl = a.pathname + a.search + a.hash;
      window.switchToTab(targetUrl);
    });
  }

  // Update bottom navigation elements
  function updateAppBottomNavActiveState(activeUrl) {
    const nav = document.getElementById('app-bottom-nav');
    if (!nav) return;

    const links = nav.querySelectorAll('a');
    links.forEach(a => {
      a.classList.remove('active');
      const href = a.getAttribute('href');
      const normalised = href.replace(/\/$/, '') || '/';
      if (activeUrl === normalised || (normalised !== '/' && activeUrl.startsWith(normalised))) {
        a.classList.add('active');
      }
    });

    updateLiquidBubble();
  }

  // Sliding glass bubble indicator
  function updateLiquidBubble() {
    const nav = document.getElementById('app-bottom-nav');
    if (!nav) return;

    let bubble = nav.querySelector('.liquid-nav-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'liquid-nav-bubble';
      nav.appendChild(bubble);
    }

    const activeLink = nav.querySelector('a.active');
    if (!activeLink) {
      bubble.style.opacity = '0';
      return;
    }

    const activeRect = activeLink.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    const left = activeRect.left - navRect.left;
    const width = activeRect.width;
    const height = activeRect.height;
    const top = activeRect.top - navRect.top;

    bubble.style.opacity = '1';
    bubble.style.width = width + 'px';
    bubble.style.height = height + 'px';
    bubble.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  window.addEventListener('resize', updateLiquidBubble);

  // ── iOS Liquid Glass detection ──────────────────────────────────────────
  // iOS 26+ introduces "Liquid Glass" as the system design language.
  // We detect iOS 26+ by parsing the user agent, then apply glass morphism
  // styles via the `liquid-glass` body class when running as an installed PWA.
  function detectLiquidGlass() {
    if (!isStandalone) return; // only apply in installed PWA mode
    const ua = navigator.userAgent || '';
    // iOS version detection: "iPhone OS 26_x" or "CPU OS 26_x" in UA string
    const iosMatch = ua.match(/(?:iPhone|iPad|iPod).*?OS (\d+)[_ ]/i) ||
                     ua.match(/CPU OS (\d+)[_ ]/i);
    const iosVersion = iosMatch ? parseInt(iosMatch[1], 10) : 0;
    if (iosVersion >= 26) {
      document.body.classList.add('liquid-glass');
      localStorage.setItem('liquid-glass-enabled', '1');
    } else if (localStorage.getItem('liquid-glass-enabled') === '1') {
      // Honour preference set in a previous session on the same device
      document.body.classList.add('liquid-glass');
    }
  }

  // ── 「加至主屏幕」安裝提示（web browser only） ────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Don't show in standalone mode — user already installed the app
    if (!isStandalone) {
      deferredPrompt = e;
      showInstallBanner();
    }
  });

  function showInstallBanner() {
    // 避免重複顯示（已安裝或用戶已關閉）
    if (localStorage.getItem('pwa-install-dismissed')) return;
    // Never show in the installed app
    if (isStandalone) return;

    // URL path is the primary signal; HTML lang attribute is a fallback
    const isEn = window.location.pathname.startsWith('/en') ||
                 document.documentElement.lang === 'en' ||
                 localStorage.getItem('appLang') === 'en';
    const bannerText = isEn
      ? '📱 Add 城市運輸單車 to your home screen for an app experience!'
      : '📱 將城市運輸單車加至主屏幕，享受 App 體驗！';
    const installLabel = isEn ? 'Install' : '安裝';
    const dismissLabel = isEn ? 'Close' : '關閉';

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <span>${bannerText}</span>
      <button id="pwa-install-btn" style="margin-left:1em;padding:0.3em 1em;background:#BFE340;color:#2c3e50;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">${installLabel}</button>
      <button id="pwa-install-dismiss" style="margin-left:0.5em;background:transparent;border:none;cursor:pointer;color:#ccc;font-size:1.2em;" aria-label="${dismissLabel}">✕</button>
    `;
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      background: '#2c3e50',
      color: '#fff',
      padding: '1em 1.5em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      flexWrap: 'wrap',
      gap: '0.5em',
    });

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.remove();
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-install-dismissed', '1');
      }
    });

    document.getElementById('pwa-install-dismiss').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('pwa-install-dismissed', '1');
    });
  }

  // ── Initialise on DOM ready ───────────────────────────────────────────────
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(() => {
    // Ensure body class is set (body is now definitely available)
    if (isStandalone) {
      document.body.classList.add('is-pwa');
      document.body.classList.add('liquid-glass'); // Always enable liquid-glass in Standalone App Mode!
      injectAppBottomNav();
      // Update theme-color meta tag to dark app theme
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#121f14');
      // Apply iOS Liquid Glass if applicable
      detectLiquidGlass();

      // Initialize PWA-only Keep-Alive SPA System
      initPwaSpaSystem();
    }
    // Apply mileage-rank theme only in installed app mode
    refreshMembershipTheme();
  });
  window.addEventListener('pageshow', refreshMembershipTheme);
  window.addEventListener('storage', (event) => {
    if (event.key === 'user' || event.key === 'silverThemeDisabled' || event.key === 'goldThemeDisabled') {
      refreshMembershipTheme();
    }
  });

  // ── 推送通知權限申請 ────────────────────────────────────────────────────
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Subscribe to server-side push now that permission is granted
      subscribeToPush();
    }
    return permission === 'granted';
  }

  // 顯示本地通知（報站用）
  function sendLocalNotification(title, body, tag) {
    if (Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      tag: tag || 'ctrc-stop',
    });
  }

  // ── 每日簽到提醒 ──────────────────────────────────────────────────────────
  // Schedules a daily check-in reminder notification using setTimeout.
  // The reminder fires once per day if the user hasn't checked in yet.
  // Reminders are ON by default; disabled only when the user explicitly turns
  // them off (checkinReminderDisabled==='1') or turns off all notifications
  // (pushNotificationsDisabled==='1').
  function scheduleDailyCheckinReminder() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('pushNotificationsDisabled') === '1') return;
    if (localStorage.getItem('checkinReminderDisabled') === '1') return;

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    // Don't remind if already checked in today
    try {
      const checkins = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
      if (checkins[todayKey]) return;
    } catch (_) {}

    // Schedule reminder for 09:00 today; if already past, skip to tomorrow
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
    if (target <= now) {
      // Already past 9am — schedule for tomorrow
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    setTimeout(() => {
      // Re-check: user may have changed settings between scheduling and firing
      const todayKeyNow = new Date().toISOString().slice(0, 10);
      try {
        const checkins = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
        if (checkins[todayKeyNow]) return; // already done
      } catch (_) {}
      if (localStorage.getItem('pushNotificationsDisabled') === '1') return;
      if (localStorage.getItem('checkinReminderDisabled') === '1') return;
      sendLocalNotification(
        '🗓️ 別忘了今日簽到！',
        '連續簽到可解鎖豐厚 XP 及里程幣獎勵，快來打卡吧！',
        'ctrc-checkin-reminder'
      );
      // Re-schedule for tomorrow
      scheduleDailyCheckinReminder();
    }, delay);
  }

  // Kick off reminder scheduling and push subscription when the page loads.
  // Notifications are ON by default: automatically request permission if not
  // yet asked, and subscribe to push unless the user has opted out.
  window.addEventListener('load', () => {
    // One-time migration: re-enable push notifications for all existing users.
    // Any previous opt-out (pushNotificationsDisabled='1') is cleared so that
    // every user starts fresh with notifications enabled by default.
    // The 'notifReset_v1' key can be removed from this migration block after
    // most active users have visited once (e.g. after ~6 months).
    if (!localStorage.getItem('notifReset_v1')) {
      localStorage.removeItem('pushNotificationsDisabled');
      localStorage.setItem('notifReset_v1', '1');
    }

    if (localStorage.getItem('pushNotificationsDisabled') === '1') return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      subscribeToPush();
      scheduleDailyCheckinReminder();
    } else if (Notification.permission !== 'denied') {
      // Auto-request permission on first visit (default ON behavior)
      requestNotificationPermission().then((granted) => {
        if (granted) scheduleDailyCheckinReminder();
      });
    }
  });

  // ── Web Push 訂閱 ─────────────────────────────────────────────────────────
  // Subscribes the current device to server-side Web Push notifications
  // using the VAPID public key. The subscription is sent to /api/push
  // so the server can send push notifications even when the app is closed.

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      // Fetch the server-side VAPID public key
      const keyRes = await fetch('/api/push');
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json();
      if (!publicKey) return;

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
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() }),
      });
    } catch (err) {
      console.warn('Push subscription failed:', err);
    }
  }

  // ── Web Push 退訂 ─────────────────────────────────────────────────────────
  // Unsubscribes the current device from server-side Web Push notifications
  // and removes the stored subscription from the server.
  async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const token = localStorage.getItem('accessToken') || '';
        await fetch('/api/push', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint }),
        });
      }
    } catch (err) {
      console.warn('Push unsubscribe failed:', err);
    }
  }

  // ── 階段性位置權限詢問 ────────────────────────────────────────────────────
  /**
   * 詢問位置權限。如果本會話（Session）已同意過，則直接執行回調。
   * @param {Function} onAllowed 同意後執行的函數
   * @param {Function} onDenied 拒絕或關閉後執行的函數
   */
  window.confirmLocationPermission = function(onAllowed, onDenied) {
    if (sessionStorage.getItem('locationApproved') === '1') {
      if (onAllowed) onAllowed();
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'location-confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:2em;backdrop-filter:blur(5px);';

    const inner = document.createElement('div');
    inner.style.cssText = 'background:var(--app-bg-card, #1e3820);border:1px solid var(--app-border, #2d4d2d);border-radius:18px;padding:1.8em;max-width:320px;text-align:center;color:var(--app-text-primary, #e8f5e9);box-shadow:0 10px 30px rgba(0,0,0,0.5);';

    inner.innerHTML = `
      <div style="font-size:3em;margin-bottom:0.3em;">📍</div>
      <h3 style="margin-bottom:0.6em;color:var(--app-accent, #6dba65);">允許使用位置</h3>
      <p style="font-size:0.9em;opacity:0.85;line-height:1.5;margin-bottom:1.5em;">為了提供精確的天氣資訊、導航以及記錄你的騎行軌跡，我們需要獲取你的即時位置。</p>
      <div style="display:flex;gap:0.8em;">
        <button id="loc-btn-no" style="flex:1;background:rgba(255,255,255,0.1);color:var(--app-text-secondary, #a8d8a0);border:none;padding:0.8em;border-radius:10px;font-weight:bold;cursor:pointer;">暫不允許</button>
        <button id="loc-btn-yes" style="flex:1;background:var(--app-accent, #6dba65);color:#121f14;border:none;padding:0.8em;border-radius:10px;font-weight:bold;cursor:pointer;">好，沒問題</button>
      </div>
    `;

    modal.appendChild(inner);
    document.body.appendChild(modal);

    const cleanup = () => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    };

    document.getElementById('loc-btn-yes').onclick = () => {
      sessionStorage.setItem('locationApproved', '1');
      cleanup();
      if (onAllowed) onAllowed();
    };

    document.getElementById('loc-btn-no').onclick = () => {
      cleanup();
      if (onDenied) onDenied();
    };
  };

  // ── 公開 API ─────────────────────────────────────────────────────────────
  window.CTRCHK_PWA = {
    isStandalone,
    requestNotificationPermission,
    sendLocalNotification,
    scheduleDailyCheckinReminder,
    subscribeToPush,
    unsubscribeFromPush,
    // Manually enable/disable Liquid Glass (for settings UI)
    enableLiquidGlass() {
      document.body.classList.add('liquid-glass');
      localStorage.setItem('liquid-glass-enabled', '1');
    },
    disableLiquidGlass() {
      document.body.classList.remove('liquid-glass');
      localStorage.removeItem('liquid-glass-enabled');
    },
    get isLiquidGlass() {
      return document.body.classList.contains('liquid-glass');
    },
  };
})();
