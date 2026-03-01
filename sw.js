const CACHE_NAME = 'tv-box-player-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/1.m3u',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;700&display=swap'
];

// Service Worker yüklendiğinde
self.addEventListener('install', (event) => {
  console.log('Service Worker yükleniyor...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Önbellek açıldı');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker aktif olduğunda
self.addEventListener('activate', (event) => {
  console.log('Service Worker aktif...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch olaylarını yakala
self.addEventListener('fetch', (event) => {
  // Sadece GET isteklerini önbelleğe al
  if (event.request.method !== 'GET') return;

  // M3U dosyası için özel strateji (her zaman güncel)
  if (event.request.url.includes('1.m3u')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Yeni M3U'yu önbelleğe al
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Çevrimdışıysa önbellekten göster
          return caches.match(event.request);
        })
    );
    return;
  }

  // Diğer dosyalar için Cache First stratejisi
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Önbellekte varsa göster
        if (response) {
          return response;
        }

        // Önbellekte yoksa ağdan al
        return fetch(event.request)
          .then((response) => {
            // Geçerli yanıt değilse direkt döndür
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Yanıtı önbelleğe al
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Video stream'leri için özel durum
            if (event.request.url.match(/\.(m3u8|ts|mp4|mkv|avi|mpg)$/)) {
              // Video stream'leri için özel bir sayfa göster
              return caches.match('/offline-video.html');
            }
          });
      })
  );
});

// Arka planda senkronizasyon
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-channels') {
    event.waitUntil(syncChannels());
  }
});

// Push bildirimleri
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('TV Box Oynatıcı', options)
  );
});

// Bildirime tıklanma
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Kanal listesini senkronize et (arka planda)
async function syncChannels() {
  try {
    const response = await fetch('/1.m3u');
    const cache = await caches.open(CACHE_NAME);
    await cache.put('/1.m3u', response);
    console.log('Kanal listesi senkronize edildi');
  } catch (error) {
    console.error('Senkronizasyon hatası:', error);
  }
}

// Önbellek temizliği (30 günde bir)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'clean-cache') {
    event.waitUntil(cleanOldCache());
  }
});

async function cleanOldCache() {
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  const now = Date.now();
  
  for (const request of requests) {
    const response = await cache.match(request);
    const dateHeader = response.headers.get('date');
    
    if (dateHeader) {
      const cacheDate = new Date(dateHeader).getTime();
      const ageInSeconds = (now - cacheDate) / 1000;
      
      if (ageInSeconds > thirtyDaysInSeconds) {
        await cache.delete(request);
        console.log('Eski önbellek silindi:', request.url);
      }
    }
  }
}
