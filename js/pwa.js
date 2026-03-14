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
          { href: '/tasks',     icon: 'fa-tasks',           label: 'Tasks' },
          isLoggedIn
            ? { href: '/dashboard', icon: 'fa-chart-bar', label: 'Progress' }
            : { href: '/login',     icon: 'fa-sign-in-alt',    label: 'Sign In' },
          { href: '#more',      icon: 'fa-ellipsis-h',     label: 'More', isMore: true },
        ]
      : [
          { href: '/',             icon: 'fa-home',           label: '首頁' },
          { href: '/routes',       icon: 'fa-biking',          label: '騎行' },
          { href: '/tasks',        icon: 'fa-tasks',           label: '任務' },
          isLoggedIn
            ? { href: '/dashboard',    icon: 'fa-chart-bar', label: '進度' }
            : { href: '/login',        icon: 'fa-sign-in-alt',    label: '登入' },
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
      // Update theme-color meta tag to dark app theme
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#121f14');
      // Apply iOS Liquid Glass if applicable
      detectLiquidGlass();
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
  // It is only active if the user has enabled it (localStorage key) and
  // notification permission is granted.
  function scheduleDailyCheckinReminder() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('checkinReminderEnabled') !== '1') return;

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
      // Re-check: user may have signed in between now and the scheduled time
      const todayKeyNow = new Date().toISOString().slice(0, 10);
      try {
        const checkins = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
        if (checkins[todayKeyNow]) return; // already done
      } catch (_) {}
      if (localStorage.getItem('checkinReminderEnabled') !== '1') return;
      sendLocalNotification(
        '🗓️ 別忘了今日簽到！',
        '連續簽到可解鎖豐厚 XP 及里程幣獎勵，快來打卡吧！',
        'ctrc-checkin-reminder'
      );
      // Re-schedule for tomorrow
      scheduleDailyCheckinReminder();
    }, delay);
  }

  // Kick off reminder scheduling when the page loads
  window.addEventListener('load', () => {
    scheduleDailyCheckinReminder();
    subscribeToPush();
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

  // ── 公開 API ─────────────────────────────────────────────────────────────
  window.CTRCHK_PWA = {
    isStandalone,
    requestNotificationPermission,
    sendLocalNotification,
    scheduleDailyCheckinReminder,
    subscribeToPush,
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
