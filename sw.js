const CACHE_NAME = 'jeocompass-v60';
const ASSETS = [
    '/jeo-pusula/',
    '/jeo-pusula/index.html',
    '/jeo-pusula/style.css',
    '/jeo-pusula/app.js',
    '/jeo-pusula/manifest.json',
    '/jeo-pusula/icon-192.png',
    '/jeo-pusula/icon-512.png'
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
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});
