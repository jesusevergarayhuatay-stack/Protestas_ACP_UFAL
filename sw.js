const CACHE_NAME = 'dp-supervision-v7';
const ASSETS = [
    './',
    './index.html',
    './defensor.html',
    './style.css',
    './app.js',
    './dashboard.js',
    './alertas.js',
    './acciones.js',
    './offline.js',
    './firebase-config.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // No cachear peticiones a Firebase ni Google APIs
    const url = event.request.url;
    if (url.includes('firebaseio.com') || url.includes('googleapis.com') || url.includes('firebasestorage')) {
        return event.respondWith(fetch(event.request));
    }

    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

// Soporte para notificaciones push (si se configura FCM en el futuro)
self.addEventListener('push', event => {
    if (!event.data) return;
    let data = {};
    try { data = event.data.json(); } catch (e) { data = { title: 'Alerta', body: event.data.text() }; }

    event.waitUntil(
        self.registration.showNotification(data.title || '🚨 Alerta Crítica', {
            body: data.body || 'Incidencia reportada.',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'dp-push-alerta',
            requireInteraction: true,
            data: { url: data.url || './defensor.html' }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const targetUrl = event.notification.data?.url || './defensor.html';
            for (const client of clientList) {
                if (client.url.includes('defensor.html') && 'focus' in client) return client.focus();
            }
            return clients.openWindow(targetUrl);
        })
    );
});
