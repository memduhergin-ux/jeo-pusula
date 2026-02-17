const CACHE_NAME = 'jeo-cache-v1453-11F-MINIMAL';
// Force Update Trigger: FINAL FIX
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://unpkg.com/leaflet.heat/dist/leaflet-heat.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Immediately control all clients
        })
    );
});


self.addEventListener('fetch', (event) => {
    // Network-First strategy for the main page (navigation requests)
    // This makes the "Refresh" button in the browser actually fetch the latest version
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-First for other assets (styles, scripts, icons)
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});
