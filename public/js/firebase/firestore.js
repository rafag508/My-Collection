// ===============================
// Firestore — BASE FINAL UNIFICADO
// ===============================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEC0LA90DIsZIAXdfbqhFgnI9_h_upKjE",
  authDomain: "my-collection-c8bf6.firebaseapp.com",
  projectId: "my-collection-c8bf6",
  storageBucket: "my-collection-c8bf6.firebasestorage.app",
  messagingSenderId: "1009311760336",
  appId: "1:1009311760336:web:ae0d0b25853daec693c3d5"
};

// INIT
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
const auth = getAuth(app);

// ===============================
// 🔍 Debug de leituras Firestore
// ===============================

let FS_DEBUG_READS_TOTAL = 0;
function logReads(label, count) {
  if (!count) return;
  FS_DEBUG_READS_TOTAL += count;
  console.log(
    `[FS-READ] ${label}: +${count} (esta aba: ~${FS_DEBUG_READS_TOTAL} docs lidos)`
  );
}

// ===============================
// 🔐 Garantir que UID existe
// ===============================

function waitForUID() {
  return new Promise(resolve => {
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      if (auth.currentUser?.uid) {
        clearInterval(check);
        resolve(auth.currentUser.uid);
        return;
      }
      if (tries > 60) { // 3 segundos (60 * 50ms = 3000ms)
        clearInterval(check);
        resolve(null);
        return;
      }
    }, 50);
  });
}

async function getUID() {
  const uid = auth.currentUser?.uid || await waitForUID();
  if (!uid) {
    throw new Error("No authenticated user - Firestore operations require authentication");
  }
  return uid;
}

async function userCollection(path) {
  const uid = await getUID();
  return collection(db, `users/${uid}/${path}`);
}

async function userDoc(path, id) {
  const uid = await getUID();
  return doc(db, `users/${uid}/${path}/${id}`);
}

// ===============================
// SERIES
// ===============================

export async function saveSerieFirestore(serie) {
  const ref = await userDoc("series", serie.id);
  return setDoc(ref, serie, { merge: true });
}

export async function getAllSeriesFirestore() {
  const col = await userCollection("series");
  const snap = await getDocs(col);
  logReads("getAllSeriesFirestore", snap.size);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteSerieFirestore(id) {
  const ref = await userDoc("series", id);
  return deleteDoc(ref);
}

// ----- SERIES ORDER -----

export async function saveSeriesOrderFirestore(order) {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/series_order`);
  return setDoc(ref, { order }, { merge: true });
}

export async function getSeriesOrderFirestore() {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/series_order`);
  const snap = await getDoc(ref);
  logReads("getSeriesOrderFirestore", snap.exists() ? 1 : 0);
  return snap.exists() ? snap.data().order : [];
}

// ----- SERIES PROGRESS -----

export async function saveSerieProgressFirestore(id, progress) {
  const ref = await userDoc("series_progress", id);
  // Usar setDoc sem merge para substituir completamente o documento
  // Isso garante que propriedades antigas (como episódios desmarcados) sejam removidas
  return setDoc(ref, progress);
}

export async function getSerieProgressFirestore(id) {
  const ref = await userDoc("series_progress", id);
  const snap = await getDoc(ref);
  logReads("getSerieProgressFirestore", snap.exists() ? 1 : 0);
  return snap.exists() ? snap.data() : { watched: {} };
}

export async function deleteSerieProgressFirestore(id) {
  const ref = await userDoc("series_progress", id);
  return deleteDoc(ref);
}

export async function getAllSeriesProgressFirestore() {
  const col = await userCollection("series_progress");
  const snap = await getDocs(col);
  logReads("getAllSeriesProgressFirestore", snap.size);
  const progress = {};
  snap.docs.forEach(d => {
    progress[d.id] = d.data();
  });
  return progress;
}


// ===============================
// MOVIES (AGORA DENTRO DO FICHEIRO PRINCIPAL)
// ===============================

export async function saveMovieFirestore(movie) {
  const ref = await userDoc("movies", movie.id);
  return setDoc(ref, movie, { merge: true });
}

export async function getAllMoviesFirestore() {
  const col = await userCollection("movies");
  const snap = await getDocs(col);
  logReads("getAllMoviesFirestore", snap.size);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteMovieFirestore(id) {
  const ref = await userDoc("movies", id);
  return deleteDoc(ref);
}

// ----- MOVIES ORDER -----

export async function saveMoviesOrderFirestore(order) {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/movies_order`);
  return setDoc(ref, { order }, { merge: true });
}

export async function getMoviesOrderFirestore() {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/movies_order`);
  const snap = await getDoc(ref);
  logReads("getMoviesOrderFirestore", snap.exists() ? 1 : 0);
  return snap.exists() ? snap.data().order : [];
}

// ----- MOVIES PROGRESS -----

export async function saveMovieProgressFirestore(id, progress) {
  const ref = await userDoc("movies_progress", id);
  return setDoc(ref, progress, { merge: true });
}

export async function getMovieProgressFirestore(id) {
  const ref = await userDoc("movies_progress", id);
  const snap = await getDoc(ref);
  logReads("getMovieProgressFirestore", snap.exists() ? 1 : 0);
  return snap.exists() ? snap.data() : { watched: false };
}

export async function getAllMoviesProgressFirestore() {
  const col = await userCollection("movies_progress");
  const snap = await getDocs(col);
  logReads("getAllMoviesProgressFirestore", snap.size);
  const progress = {};
  snap.docs.forEach(d => {
    progress[d.id] = d.data();
  });
  return progress;
}

export async function deleteMovieProgressFirestore(id) {
  const ref = await userDoc("movies_progress", id);
  return deleteDoc(ref);
}


// ===============================
// NOTIFICATIONS
// ===============================

export async function saveNotificationFirestore(notif) {
  const ref = await userDoc("notifications", notif.id);
  return setDoc(ref, notif, { merge: true });
}

export async function getNotificationsFirestore() {
  const col = await userCollection("notifications");
  const snap = await getDocs(col);
  logReads("getNotificationsFirestore", snap.size);
  return snap.docs.map(d => d.data());
}

export async function clearNotificationFirestore() {
  const col = await userCollection("notifications");
  const snap = await getDocs(col);
  for (const d of snap.docs) await deleteDoc(d.ref);
}

export async function deleteNotificationFirestore(notifId) {
  const ref = await userDoc("notifications", notifId);
  return deleteDoc(ref);
}

// ===============================
// USER PREFERENCES
// ===============================

export async function saveUserPreferencesFirestore(preferences) {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/preferences`);
  return setDoc(ref, preferences, { merge: true });
}

export async function getUserPreferencesFirestore() {
  try {
    const uid = await getUID();
    const ref = doc(db, `users/${uid}/meta/preferences`);
    const snap = await getDoc(ref);
    logReads("getUserPreferencesFirestore", snap.exists() ? 1 : 0);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn("Could not load user preferences from Firestore:", err);
    return null;
  }
}

// ===============================
// FCM TOKEN (Múltiplos tokens por dispositivo)
// ===============================

/**
 * Gera um ID único para o dispositivo
 */
async function generateDeviceId() {
  // Usar localStorage para guardar deviceId persistente
  let deviceId = localStorage.getItem('fcm_device_id');
  if (!deviceId) {
    // Gerar novo ID baseado em user agent + timestamp
    const userAgent = navigator.userAgent;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    deviceId = btoa(`${userAgent}-${timestamp}-${random}`).substring(0, 32);
    localStorage.setItem('fcm_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Guarda múltiplos tokens FCM (um por dispositivo) com limite de 5 dispositivos
 * @param {string} token - Token FCM
 * @param {string|null} deviceId - ID do dispositivo (gerado automaticamente se não fornecido)
 */
export async function saveFCMTokenToFirestore(token, deviceId = null) {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/fcmTokens`);
  
  const MAX_DEVICES = 5; // Limite máximo de dispositivos
  const MAX_AGE_DAYS = 30; // Remover tokens com mais de 30 dias
  
  // Obter tokens existentes
  const snap = await getDoc(ref);
  logReads("saveFCMTokenToFirestore", 1);
  let tokens = snap.exists() ? (snap.data().tokens || []) : [];
  
  // ✅ MIGRAÇÃO: Se não há tokens no novo formato, verificar formato antigo
  if (tokens.length === 0) {
    try {
      const oldRef = doc(db, `users/${uid}/meta/fcmToken`);
      const oldSnap = await getDoc(oldRef);
      logReads("saveFCMTokenToFirestore (migration)", oldSnap.exists ? 1 : 0);
      
      if (oldSnap.exists) {
        const oldData = oldSnap.data();
        const oldToken = oldData.token;
        if (oldToken) {
          // Migrar token antigo para novo formato
          console.log('[FCM] Migrating old token format to new format');
          tokens = [{
            token: oldToken,
            deviceId: 'migrated_' + Date.now(),
            updatedAt: oldData.updatedAt || Date.now()
          }];
          
          // Apagar documento antigo (opcional, pode manter para backup)
          // await deleteDoc(oldRef);
        }
      }
    } catch (migrationError) {
      console.warn('[FCM] Migration check failed:', migrationError);
    }
  }
  
  // Gerar deviceId se não fornecido
  if (!deviceId) {
    deviceId = await generateDeviceId();
  }
  
  // 1. Limpar tokens antigos (mais de 30 dias sem atualização)
  const maxAge = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  tokens = tokens.filter(t => t.updatedAt > maxAge);
  
  // 2. Verificar se token já existe
  const existingIndex = tokens.findIndex(t => t.token === token);
  if (existingIndex >= 0) {
    // Atualizar token existente (atualizar deviceId e timestamp)
    tokens[existingIndex] = {
      token,
      deviceId,
      updatedAt: Date.now()
    };
    console.log(`[FCM] Updated existing token (device: ${deviceId.substring(0, 8)}...)`);
  } else {
    // 3. Verificar limite de dispositivos
    if (tokens.length >= MAX_DEVICES) {
      // Remover o mais antigo (ordenar por updatedAt)
      tokens.sort((a, b) => a.updatedAt - b.updatedAt);
      const removed = tokens.shift(); // Remove o primeiro (mais antigo)
      console.log(`[FCM] Removed oldest device token (limit: ${MAX_DEVICES}, device: ${removed.deviceId?.substring(0, 8)}...)`);
    }
    
    // Adicionar novo token
    tokens.push({
      token,
      deviceId,
      updatedAt: Date.now()
    });
    console.log(`[FCM] Added new token (device: ${deviceId.substring(0, 8)}...)`);
  }
  
  // 4. Remover duplicados (mesmo token em múltiplos dispositivos)
  const seenTokens = new Set();
  tokens = tokens.filter(t => {
    if (seenTokens.has(t.token)) {
      return false; // Duplicado, remover
    }
    seenTokens.add(t.token);
    return true;
  });
  
  return setDoc(ref, { 
    tokens: tokens,
    lastUpdated: Date.now()
  }, { merge: true });
}

/**
 * Obtém todos os tokens FCM do utilizador
 * @returns {Promise<string[]>} Array de tokens FCM
 */
export async function getFCMTokensFromFirestore() {
  try {
    const uid = await getUID();
    const ref = doc(db, `users/${uid}/meta/fcmTokens`);
    const snap = await getDoc(ref);
    logReads("getFCMTokensFromFirestore", snap.exists() ? 1 : 0);
    
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.tokens)) {
        return data.tokens.map(t => t.token).filter(Boolean);
      }
    }
    return [];
  } catch (err) {
    console.warn("Could not get FCM tokens from Firestore:", err);
    return [];
  }
}

/**
 * Obtém um único token FCM (compatibilidade com código antigo)
 * @deprecated Use getFCMTokensFromFirestore() para obter todos os tokens
 */
export async function getFCMTokenFromFirestore() {
  const tokens = await getFCMTokensFromFirestore();
  return tokens.length > 0 ? tokens[0] : null;
}