const CACHE_NAME = 'jeocompass-v1';
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
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});
