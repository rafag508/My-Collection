// firebase-messaging-sw.js
// Service Worker para Firebase Cloud Messaging
// Este ficheiro deve estar na raiz do public/ para o FCM funcionar

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCEC0LA90DIsZIAXdfbqhFgnI9_h_upKjE",
  authDomain: "my-collection-c8bf6.firebaseapp.com",
  projectId: "my-collection-c8bf6",
  storageBucket: "my-collection-c8bf6.firebasestorage.app",
  messagingSenderId: "1009311760336",
  appId: "1:1009311760336:web:ae0d0b25853daec693c3d5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Receber mensagens em background (quando a app está fechada)
messaging.onBackgroundMessage(async (payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'My Collection';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/favicons/apple-touch-icon.png', // Ícone padrão (quadrado azul com MC)
    badge: '/favicons/favicon-32x32.png', // Badge pequeno
    image: payload.notification?.image || null, // Imagem grande (poster do filme)
    tag: 'my-collection-notification',
    data: payload.data
  };

  // Atualizar badge quando recebe notificação (mesmo com app fechada)
  try {
    if ('setAppBadge' in navigator) {
      // Tentar obter o badge atual
      let currentBadge = 0;
      try {
        // Nota: getAppBadge() pode não estar disponível em todos os browsers
        // Se não estiver, assumimos 0 e incrementamos
        if ('getAppBadge' in navigator && typeof navigator.getAppBadge === 'function') {
          currentBadge = await navigator.getAppBadge() || 0;
        }
      } catch (e) {
        // Se não conseguir obter, assume 0
        currentBadge = 0;
      }
      
      // Incrementar badge em 1
      await navigator.setAppBadge(currentBadge + 1);
      console.log('[Service Worker] Badge updated to:', currentBadge + 1);
    }
  } catch (badgeError) {
    console.warn('[Service Worker] Failed to update badge:', badgeError);
  }

  await self.registration.showNotification(notificationTitle, notificationOptions);
});

