// CTRC HK Service Worker — PWA 離線緩存
// Version: 1.0.0

const CACHE_NAME = 'ctrchk-v1';
const STATIC_CACHE = 'ctrchk-static-v1';
const DYNAMIC_CACHE = 'ctrchk-dynamic-v1';

// 預緩存的靜態資源（核心 shell）
const PRECACHE_URLS = [
  '/',
  '/routes',
  '/dashboard',
  '/login',
  '/css/main.css',
  '/js/main.js',
  '/js/login.js',
  '/js/pwa.js',
  '/header.html',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
];

// ── 安裝階段：預緩存靜態資源 ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── 啟動階段：清理舊緩存 ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ── 攔截網絡請求：Cache-first for statics, Network-first for API ────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只處理同源請求（跳過第三方 CDN 等）
  if (url.origin !== self.location.origin) return;

  // API 請求：Network-first，失敗時返回錯誤提示
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 緩存成功的 GET 回應（供離線使用）
          if (request.method === 'GET' && res.ok) {
            const clone = res.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ message: '離線模式，無法連接伺服器' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
          )
        )
    );
    return;
  }

  // GPX 文件：Cache-first（GPX 不常變動）
  if (url.pathname.startsWith('/gpx/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 圖片：Cache-first
  if (
    url.pathname.startsWith('/images/') ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 其他靜態資源（HTML/CSS/JS）：Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ── 推送通知處理 ──────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || '🚏 CTRC HK';
  const options = {
    body: data.body || '',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    tag: data.tag || 'ctrc-notification',
    data: data.url ? { url: data.url } : {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 點擊通知時跳轉
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
