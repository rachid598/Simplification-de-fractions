/* ============================================================
   FRAC-STRIKE — Service Worker (Cache-First Offline)
   ============================================================ */

var CACHE_NAME = 'fracstrike-v3';

var STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

/* --- Install: pre-cache static assets --- */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

/* --- Activate: clean old caches --- */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        })
    );
    self.clients.claim();
});

/* --- Fetch: cache-first, network fallback --- */
self.addEventListener('fetch', function (event) {
    /* Only handle GET requests */
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;

            return fetch(event.request).then(function (response) {
                /* Cache successful responses for fonts and static assets */
                if (response.ok && shouldCache(event.request.url)) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function () {
                /* Offline fallback for navigation */
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

function shouldCache(url) {
    return url.includes('fonts.googleapis.com') ||
           url.includes('fonts.gstatic.com') ||
           url.endsWith('.css') ||
           url.endsWith('.js') ||
           url.endsWith('.svg') ||
           url.endsWith('.png') ||
           url.endsWith('.html');
}
