/* ============================================================================
   운명사주 정운타임즈 · service-worker.js
   - 앱 셸(app shell)은 미리 캐시, 문서는 네트워크 우선 + 캐시 폴백
   - 이미지·4P 등 정적 자원은 캐시 우선(백그라운드 갱신)
   ========================================================================== */
const VERSION = 'jw-times-v41';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/paper.css',
  './assets/js/engine.js',
  './assets/js/data.js',
  './assets/js/articles-1.js',
  './assets/js/articles-2.js',
  './assets/js/articles-3.js',
  './assets/js/articles-extra.js',
  './assets/js/articles-top7.js',
  './assets/js/articles-daily.js',
  './assets/js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (e) { /* 개별 실패는 무시 */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 외부 도메인(폰트 CDN 등)은 브라우저 기본 동작에 맡긴다.
  if (url.origin !== self.location.origin) return;

  // 문서 요청: 네트워크 우선, 실패하면 캐시 → 오프라인 셸
  if (req.mode === 'navigate'){
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 매일 갱신되는 파일은 네트워크 우선(오프라인일 때만 캐시)
  const VOLATILE = ['/assets/js/articles-daily.js', '/assets/js/articles-top7.js', '/assets/js/fourp.js', '/assets/js/app.js', '/assets/js/data.js'];
  if (VOLATILE.some(p => url.pathname.endsWith(p))){
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok){
          const cache = await caches.open(RUNTIME);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cache = await caches.open(RUNTIME);
        const hit = await cache.match(req);
        if (hit) return hit;
        const shell = await caches.open(SHELL);
        return (await shell.match(req)) || new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // 정적 자원: 캐시 우선 + 백그라운드 갱신
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    const hit = await cache.match(req);
    if (hit){
      fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(()=>{});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && (url.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|woff2?|html)$/) || req.destination === 'image')){
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      const shell = await caches.open(SHELL);
      return (await shell.match(req)) || new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
