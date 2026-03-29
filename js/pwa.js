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
