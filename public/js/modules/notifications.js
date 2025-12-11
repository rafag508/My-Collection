// js/modules/notifications.js
import { storageService } from "./storageService.js";
import {
  saveNotificationFirestore,
  getNotificationsFirestore,
  clearNotificationFirestore,
  deleteNotificationFirestore
} from "../firebase/firestore.js";
import { isGuestMode } from "./guestMode.js";

const NOTIF_KEY = "notifications";
const MAX_NOTIFICATIONS = 150;
const MAX_AGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Para evitar loops infinitos de sync (navbar -> getNotifications -> Firestore -> evento -> navbar ...)
// fazemos sync com o Firestore no máximo UMA vez por carregamento de página.
const NOTIFICATIONS_SYNC_FLAG_KEY = "hasSyncedNotificationsFromFirestoreOnce";

/**
 * Remove notificações com mais de 30 dias
 */
async function cleanOldNotifications(list) {
  if (!Array.isArray(list)) return [];
  
  const now = Date.now();
  const maxAge = MAX_AGE_DAYS * MS_PER_DAY;
  
  return list.filter(notif => {
    const age = now - (notif.timestamp || 0);
    return age <= maxAge;
  });
}

/**
 * Remove notificações antigas até ficar abaixo do limite
 * Remove sempre a mais antiga primeiro
 */
async function enforceMaxLimit(list) {
  if (!Array.isArray(list)) return [];
  
  if (list.length <= MAX_NOTIFICATIONS) return list;
  
  // Ordenar por timestamp (mais antigas primeiro)
  const sorted = [...list].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  // Manter apenas as MAX_NOTIFICATIONS mais recentes
  const toKeep = sorted.slice(-MAX_NOTIFICATIONS);
  const toRemove = sorted.slice(0, sorted.length - MAX_NOTIFICATIONS);
  
  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return toKeep;
  }
  
  // Remover do Firestore (best effort, não bloqueia)
  try {
    for (const notif of toRemove) {
      if (notif.id) {
        await deleteNotificationFirestore(notif.id);
      }
    }
  } catch (e) {
    console.warn("Could not delete old notifications from Firestore:", e);
  }
  
  return toKeep;
}

export async function addNotification(notif) {
  notif.id = notif.id || crypto.randomUUID();
  notif.timestamp = notif.timestamp || Date.now();
  notif.read = false; // Nova notificação começa como não lida

  // 1️⃣ Carregar lista atual
  let list = await storageService.get(NOTIF_KEY, []);
  
  // 2️⃣ Limpar notificações com mais de 30 dias
  list = await cleanOldNotifications(list);
  
  // 3️⃣ Adicionar nova notificação
  list.push(notif);
  
  // 4️⃣ Se exceder limite, remover as mais antigas
  list = await enforceMaxLimit(list);
  
  // 5️⃣ Salvar localmente
  await storageService.set(NOTIF_KEY, list);

  // 6️⃣ Salvar no Firestore (best effort) - apenas se não estiver em modo convidado
  if (!isGuestMode()) {
  try {
    await saveNotificationFirestore(notif);
  } catch (e) {
    console.warn("Could not save notification to Firestore:", e);
    }
  }
  
  // 7️⃣ Disparar evento para atualizar UI
  document.dispatchEvent(new CustomEvent("notificationsUpdated", {
    detail: { data: list }
  }));
}

export async function getNotifications() {
  // Return cache immediately (UI instantânea)
  let local = await storageService.get(NOTIF_KEY, []);
  
  // Limpar notificações antigas ao carregar
  local = await cleanOldNotifications(local);
  
  // Garantir que não excede o limite
  local = await enforceMaxLimit(local);
  
  // Salvar de volta se houve limpeza
  const originalLength = (await storageService.get(NOTIF_KEY, [])).length;
  if (local.length !== originalLength) {
    await storageService.set(NOTIF_KEY, local);
  }
  
  // Garantir compatibilidade: notificações antigas sem campo 'read' são tratadas como não lidas
  const result = (Array.isArray(local) ? local : []).map(notif => {
    if (notif.read === undefined) {
      return { ...notif, read: false };
    }
    return notif;
  });

  // Em modo convidado, não sincronizar com Firestore
  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(NOTIFICATIONS_SYNC_FLAG_KEY) === "true";
  
  if (!isGuestMode() && !hasSynced) {
    sessionStorage.setItem(NOTIFICATIONS_SYNC_FLAG_KEY, "true");
  // Sync with Firestore in background (não bloqueia)
  getNotificationsFirestore().then(async (remote) => {
    if (Array.isArray(remote)) {
      // Garantir compatibilidade também para dados do Firestore
      let normalized = remote.map(notif => {
        if (notif.read === undefined) {
          return { ...notif, read: false };
        }
        return notif;
      });
      
      // Aplicar limpeza automática também aos dados do Firestore
      normalized = await cleanOldNotifications(normalized);
      normalized = await enforceMaxLimit(normalized);
      
      await storageService.set(NOTIF_KEY, normalized);
      document.dispatchEvent(new CustomEvent("notificationsSynced", {
        detail: { source: "firestore", data: normalized }
      }));
    }
  }).catch(err => {
      console.warn("getNotifications: sync failed:", err);
  });
  }

  return result;
}

export async function clearNotifications() {
  await storageService.set(NOTIF_KEY, []);
  
  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }
  
  try {
    await clearNotificationFirestore();
  } catch {}
}

/**
 * Marca todas as notificações como lidas
 */
export async function markAllAsRead() {
  let list = await storageService.get(NOTIF_KEY, []);
  if (!Array.isArray(list) || list.length === 0) return;

  // Limpar notificações antigas antes de marcar como lidas
  list = await cleanOldNotifications(list);
  list = await enforceMaxLimit(list);

  let hasChanges = false;
  const updated = list.map(notif => {
    if (!notif.read) {
      hasChanges = true;
      return { ...notif, read: true };
    }
    return notif;
  });

  if (hasChanges) {
    await storageService.set(NOTIF_KEY, updated);
    
    // Em modo convidado, não sincronizar com Firestore
    if (!isGuestMode()) {
    // Atualizar no Firestore (best effort, não bloqueia)
    try {
      for (const notif of updated) {
        if (notif.read) {
          await saveNotificationFirestore(notif);
        }
      }
    } catch (e) {
      console.warn("Could not update notifications in Firestore:", e);
      }
    }
    
    // Disparar evento para atualizar contador no navbar
    document.dispatchEvent(new CustomEvent("notificationsUpdated", {
      detail: { data: updated }
    }));
  }

  return updated;
}

/**
 * Conta apenas notificações não lidas
 */
export function getUnreadCount(notifications) {
  if (!Array.isArray(notifications)) return 0;
  return notifications.filter(n => !n.read).length;
}
