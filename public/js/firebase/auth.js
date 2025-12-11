// src/firebase/auth.js
// ===============================
// Firebase Auth (CORRIGIDO)
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { isGuestMode } from "../modules/guestMode.js";

// === FIREBASE CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyCEC0LA90DIsZIAXdfbqhFgnI9_h_upKjE",
  authDomain: "my-collection-c8bf6.firebaseapp.com",
  projectId: "my-collection-c8bf6",
  storageBucket: "my-collection-c8bf6.firebasestorage.app",
  messagingSenderId: "1009311760336",
  appId: "1:1009311760336:web:ae0d0b25853daec693c3d5"
};

// === INIT ONCE ===
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// persist login between sessions
setPersistence(auth, browserLocalPersistence);

let currentUser = null;
const userListeners = [];

/**
 * protectPage() — aguarda o estado do auth antes de prosseguir.
 * Resolve com o user (ou null) quando o estado estiver pronto.
 * Redireciona para login se necessário (comportamento igual ao que já tinhas).
 * Suporta modo convidado (sem Firebase Auth).
 */
export function protectPage() {
  return new Promise(resolve => {
    // Verificar se está em modo convidado
    if (isGuestMode()) {
      const onLogin = window.location.pathname.includes("login.html");
      if (onLogin) {
        window.location.href = "./index.html";
        return;
      }
      // Em modo convidado, não há user do Firebase, mas permite acesso
      console.log("Auth pronta: Modo Convidado (sem Firebase)");
      resolve(null); // null indica modo convidado
      return;
    }

    const unsub = onAuthStateChanged(auth, user => {
      currentUser = user;
      userListeners.forEach(fn => fn?.(user));
      unsub();

      const onLogin = window.location.pathname.includes("login.html");

      if (!user && !onLogin) {
        window.location.href = "./login.html";
        return;
      }

      if (user && onLogin) {
        window.location.href = "./index.html";
        return;
      }

      console.log("Auth pronta:", user?.uid);
      resolve(user);
    });
  });
}

// ===============================
// Export helpers
// ===============================
export function getCurrentUID() { 
  // Em modo convidado, retorna null (não há UID)
  if (isGuestMode()) return null;
  return currentUser?.uid || null; 
}
export function getCurrentUser() { 
  // Em modo convidado, retorna null (não há user do Firebase)
  if (isGuestMode()) return null;
  return currentUser; 
}
export function onUserChanged(cb) { userListeners.push(cb); }

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code };
  }
}

export async function register(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code };
  }
}

export async function loginAnonymous() {
  try {
    await signInAnonymously(auth);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code };
  }
}

export async function logout() {
  // Se estiver em modo convidado, limpar sessionStorage
  if (isGuestMode()) {
    const { disableGuestMode } = await import("../modules/guestMode.js");
    disableGuestMode();
    return;
  }
  await signOut(auth);
}

export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code };
  }
}

export async function changePassword(currentPassword, newPassword) {
  try {
    // Sempre usar auth.currentUser (utilizador atualmente autenticado)
    const user = auth.currentUser;
    
    if (!user) {
      return { ok: false, error: "auth/user-not-found" };
    }
    
    // Verificar se é utilizador anónimo
    if (user.isAnonymous) {
      return { ok: false, error: "auth/anonymous-user" };
    }
    
    // Verificar se tem email (necessário para reautenticação)
    if (!user.email) {
      return { ok: false, error: "auth/user-not-found" };
    }

    // Reautenticar com password atual usando o email do utilizador autenticado
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Atualizar password do utilizador autenticado
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code };
  }
}
