const CACHE_NAME = 'jeocompass-v660';
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
        caches.keys().then((names) => {
            return Promise.all(
                names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            );
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            // Send message to all clients to reload
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage('sw-updated'));
            });
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
