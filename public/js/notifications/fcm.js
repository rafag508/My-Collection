// js/notifications/fcm.js
// Firebase Cloud Messaging - Push Notifications

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { saveFCMTokenToFirestore, getFCMTokenFromFirestore } from "../firebase/firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEC0LA90DIsZIAXdfbqhFgnI9_h_upKjE",
  authDomain: "my-collection-c8bf6.firebaseapp.com",
  projectId: "my-collection-c8bf6",
  storageBucket: "my-collection-c8bf6.firebasestorage.app",
  messagingSenderId: "1009311760336",
  appId: "1:1009311760336:web:ae0d0b25853daec693c3d5"
};

let messaging = null;
let fcmToken = null;

/**
 * Inicializa Firebase Cloud Messaging
 */
export async function initFCM() {
  // Verificar se FCM é suportado
  const supported = await isSupported();
  if (!supported) {
    console.warn('FCM is not supported in this browser');
    return false;
  }

  try {
    // Inicializar Firebase App se ainda não estiver inicializado
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    
    // Obter instância do Messaging
    messaging = getMessaging(app);
    
    // Pedir permissão e obter token
    await requestPermission();
    
    // Escutar mensagens quando a app está aberta
    onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      showNotification(payload);
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return false;
  }
}

/**
 * Pede permissão para notificações e obtém o token FCM
 */
async function requestPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Obter Service Worker registration para o FCM usar
      let serviceWorkerRegistration = null;
      if ('serviceWorker' in navigator) {
        try {
          // Tentar obter o Service Worker já registado
          const registration = await navigator.serviceWorker.ready;
          serviceWorkerRegistration = registration;
          console.log('[FCM] Using Service Worker:', registration.scope);
        } catch (swError) {
          console.warn('[FCM] Could not get Service Worker registration:', swError);
        }
      }
      
      // Obter token FCM com Service Worker registration
      const tokenOptions = {
        vapidKey: 'BCyOXQ4udAZhBEZpdDG_Ky_Uxfs5Zsq6P0Lm7M1-V6VBHlWXketvL3UxY7ogzoWY5ylXEW-BCqnIYvnwKLHfm-g'
      };
      
      // Se tivermos Service Worker registration, usar
      if (serviceWorkerRegistration) {
        tokenOptions.serviceWorkerRegistration = serviceWorkerRegistration;
      }
      
      fcmToken = await getToken(messaging, tokenOptions);
      
      if (fcmToken) {
        // Gerar deviceId e guardar token
        try {
          const deviceId = await generateDeviceId();
          await saveFCMTokenToFirestore(fcmToken, deviceId);
          console.log(`FCM Token saved to Firestore (device: ${deviceId.substring(0, 8)}...)`);
        } catch (err) {
          console.warn('Failed to save FCM token to Firestore:', err);
        }
      } else {
        console.warn('[FCM] No token received. Check Service Worker registration and permissions.');
      }
    } else {
      console.warn('Notification permission denied');
    }
  } catch (error) {
    console.error('Error requesting permission:', error);
  }
}

/**
 * Mostra uma notificação quando a app está aberta
 */
function showNotification(payload) {
  const { title, body, icon, image } = payload.notification || {};
  
  if (title && body) {
    new Notification(title, {
      body,
      icon: icon || '/favicons/apple-touch-icon.png', // Ícone padrão (quadrado azul com MC)
      badge: '/favicons/favicon-32x32.png', // Badge pequeno
      image: image || null, // Imagem grande (poster do filme)
      tag: 'my-collection-notification'
    });
  }
}

/**
 * Obtém o token FCM atual
 */
export function getFCMToken() {
  return fcmToken;
}

