// js/pwa.js — CTRC HK PWA 輔助功能
// 負責：Service Worker 註冊、安裝提示、推送通知、GPS 狀態顯示
// Phase 1: PWA / Web separation — .app-only elements visible only in app,
//          .web-only elements visible only in browser.

(function () {
  'use strict';

  // ── Detect standalone (installed PWA) mode ──────────────────────────────
  // Chrome/Android: matchMedia('(display-mode: standalone)')
  // iOS Safari: navigator.standalone === true
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

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
  }

  // ── App bottom navigation bar (injected only in standalone mode) ─────────
  function injectAppBottomNav() {
    if (document.getElementById('app-bottom-nav')) return; // already injected

    const isEn = window.location.pathname.startsWith('/en') ||
                 document.documentElement.lang === 'en';

    const isLoggedIn = !!localStorage.getItem('accessToken');

    const links = isEn
      ? [
          { href: '/en',        icon: 'fa-home',           label: 'Home' },
          { href: '/en/routes', icon: 'fa-biking',          label: 'Ride' },
          isLoggedIn
            ? { href: '/dashboard', icon: 'fa-chart-bar', label: 'Progress' }
            : { href: '/login',     icon: 'fa-sign-in-alt',    label: 'Sign In' },
          { href: '/profile',   icon: 'fa-user',           label: 'My' },
          { href: '#more',      icon: 'fa-ellipsis-h',     label: 'More', isMore: true },
        ]
      : [
          { href: '/',             icon: 'fa-home',           label: '首頁' },
          { href: '/routes',       icon: 'fa-biking',          label: '騎行' },
          isLoggedIn
            ? { href: '/dashboard',    icon: 'fa-chart-bar', label: '進度' }
            : { href: '/login',        icon: 'fa-sign-in-alt',    label: '登入' },
          { href: '/profile',      icon: 'fa-user',           label: '我的' },
          { href: '#more',         icon: 'fa-ellipsis-h',     label: '更多', isMore: true },
        ];

    const moreItems = isEn
      ? [
          { href: '/en/about',      icon: 'fa-info-circle',   label: 'About' },
          { href: '/en/membership', icon: 'fa-star',          label: 'Membership' },
          { href: '/en/blog',       icon: 'fa-newspaper',     label: 'Blog' },
          { href: '/en/contact',    icon: 'fa-envelope',      label: 'Contact' },
          { href: '/',              icon: 'fa-language',      label: '繁體中文' },
        ]
      : [
          { href: '/about',        icon: 'fa-info-circle',   label: '關於我們' },
          { href: '/membership',   icon: 'fa-star',          label: '會員計劃' },
          { href: '/blog',         icon: 'fa-newspaper',     label: '部落格' },
          { href: '/contact',      icon: 'fa-envelope',      label: '聯絡我們' },
          { href: '/en',           icon: 'fa-language',      label: 'English' },
        ];

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    const nav = document.createElement('nav');
    nav.id = 'app-bottom-nav';
    nav.setAttribute('aria-label', isEn ? 'App navigation' : 'App 導航');

    links.forEach(({ href, icon, label, isMore }) => {
      const a = document.createElement('a');
      a.href = isMore ? '#' : href;
      if (!isMore) {
        const normalised = href.replace(/\/$/, '') || '/';
        if (currentPath === normalised || (normalised !== '/' && currentPath.startsWith(normalised))) {
          a.classList.add('active');
        }
      }
      a.innerHTML = `<i class="fas ${icon}"></i><span>${label}</span>`;
      if (isMore) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          toggleMoreSheet();
        });
      }
      nav.appendChild(a);
    });

    document.body.appendChild(nav);

    // ── Inject "More" slide-up sheet ──────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'app-more-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)',
      zIndex: '1998', display: 'none',
    });
    overlay.addEventListener('click', () => toggleMoreSheet(false));

    const sheet = document.createElement('div');
    sheet.id = 'app-more-sheet';
    Object.assign(sheet.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      background: '#1a2e1a', borderRadius: '16px 16px 0 0',
      padding: '1.2em 1em', zIndex: '1999', display: 'none',
      paddingBottom: 'calc(5em + env(safe-area-inset-bottom))',
    });

    const sheetTitle = document.createElement('p');
    sheetTitle.textContent = isEn ? 'More' : '更多';
    Object.assign(sheetTitle.style, {
      margin: '0 0 0.8em 0.5em', fontWeight: 'bold', color: '#a8d8a0', fontSize: '1.1em',
    });
    sheet.appendChild(sheetTitle);

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8em',
    });

    moreItems.forEach(({ href, icon, label }) => {
      const item = document.createElement('a');
      item.href = href;
      Object.assign(item.style, {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4em',
        padding: '0.8em 0.5em', borderRadius: '10px', background: '#243824',
        color: '#a8d8a0', textDecoration: 'none', fontSize: '0.75em', fontWeight: 'bold',
      });
      item.innerHTML = `<i class="fas ${icon}" style="font-size:1.5em; color:#6dba65;"></i><span>${label}</span>`;
      grid.appendChild(item);
    });

    // Auth row (login / logout)
    const authItem = document.createElement('a');
    authItem.id = 'app-more-auth-btn';
    const token = localStorage.getItem('accessToken');
    if (token) {
      authItem.href = '#';
      authItem.innerHTML = `<i class="fas fa-sign-out-alt" style="font-size:1.5em; color:#e74c3c;"></i><span>${isEn ? 'Sign Out' : '登出'}</span>`;
      authItem.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      });
    } else {
      authItem.href = '/login';
      authItem.innerHTML = `<i class="fas fa-sign-in-alt" style="font-size:1.5em; color:#6dba65;"></i><span>${isEn ? 'Sign In' : '登入'}</span>`;
    }
    Object.assign(authItem.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4em',
      padding: '0.8em 0.5em', borderRadius: '10px', background: '#243824',
      color: '#a8d8a0', textDecoration: 'none', fontSize: '0.75em', fontWeight: 'bold',
    });
    grid.appendChild(authItem);

    sheet.appendChild(grid);
    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
  }

  function toggleMoreSheet(forceOpen) {
    const sheet = document.getElementById('app-more-sheet');
    const overlay = document.getElementById('app-more-overlay');
    if (!sheet || !overlay) return;
    const isOpen = sheet.style.display !== 'none';
    const open = forceOpen !== undefined ? forceOpen : !isOpen;
    sheet.style.display = open ? 'block' : 'none';
    overlay.style.display = open ? 'block' : 'none';
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
                 document.documentElement.lang === 'en';
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
      injectAppBottomNav();
    }
  });

  // ── 推送通知權限申請 ────────────────────────────────────────────────────
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
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

  // ── 公開 API ─────────────────────────────────────────────────────────────
  window.CTRCHK_PWA = {
    isStandalone,
    requestNotificationPermission,
    sendLocalNotification,
  };
})();
