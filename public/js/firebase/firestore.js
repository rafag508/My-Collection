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
// FCM TOKEN
// ===============================

export async function saveFCMTokenToFirestore(token) {
  const uid = await getUID();
  const ref = doc(db, `users/${uid}/meta/fcmToken`);
  return setDoc(ref, { 
    token: token,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function getFCMTokenFromFirestore() {
  try {
    const uid = await getUID();
    const ref = doc(db, `users/${uid}/meta/fcmToken`);
    const snap = await getDoc(ref);
    logReads("getFCMTokenFromFirestore", snap.exists() ? 1 : 0);
    return snap.exists() ? snap.data().token : null;
  } catch (err) {
    console.warn("Could not get FCM token from Firestore:", err);
    return null;
  }
}