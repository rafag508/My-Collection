// Service Worker para PWA
// Cacheia apenas assets estáticos, NUNCA dados do Firestore

const CACHE_NAME = 'my-collection-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/favicon.ico',
  '/favicons/favicon-32x32.png',
  '/favicons/favicon-16x16.png'
];

// Instalar Service Worker e cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Some assets failed to cache:', err);
        // Continua mesmo se alguns assets falharem
        return Promise.resolve();
      });
    })
  );
  
  // Força ativação imediata do novo Service Worker
  self.skipWaiting();
});

// Ativar Service Worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Assume controle imediato de todas as páginas
  return self.clients.claim();
});

// ❌ REMOVIDO: Listener push removido para evitar duplicação
// O firebase-messaging-sw.js já processa push notifications via FCM
// Deixar apenas o FCM processar para evitar 2 notificações

// Lidar com cliques em notificações (mantido para compatibilidade)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = '/notifications.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já há uma janela aberta, focar nela
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não há janela aberta, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // ✅ NUNCA interceptar Firestore, Auth, ou outras APIs dinâmicas
  // Retornar imediatamente sem interceptar para evitar interferência
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    // Não interceptar - deixar passar diretamente sem interferência
    return;
  }
  
  // Network-first strategy para CSS/JS (verifica servidor primeiro, cache como fallback)
  // Isto garante que atualizações de CSS/JS sejam sempre verificadas primeiro
  event.respondWith(
    fetch(event.request).then((response) => {
      // Verificar se é um asset estático que deve ser cacheado
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Se a rede falhar, tentar cache como fallback
      return caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        // Se falhar e for HTML, retorna index.html (para SPA)
        const acceptHeader = event.request.headers.get('accept');
        if (acceptHeader && acceptHeader.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

