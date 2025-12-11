// src/modules/series/seriesDataManager.js
// Now uses Firestore as primary storage and localStorage as a cache.
// Behavior:
// - read: try Firestore -> if success save cache and return; if failure fallback to cache
// - write (add/update/delete/saveOrder): try Firestore, always update cache locally so UI updates instantly

import { storageService } from "../storageService.js";
import {
  getAllSeriesFirestore,
  saveSerieFirestore,
  deleteSerieFirestore,
  getSeriesOrderFirestore,
  saveSeriesOrderFirestore
} from "../../firebase/firestore.js";
import { updateSerieProgress, deleteSerieProgress } from "./seriesProgress.js";
import { isGuestMode } from "../guestMode.js";

const SERIES_KEY = "series";
const SERIES_ORDER_KEY = "series_order";

// Helper: save to local cache (no network)
async function saveCacheSeries(seriesList) {
  await storageService.set(SERIES_KEY, seriesList);
}

async function saveCacheOrder(order) {
  await storageService.set(SERIES_ORDER_KEY, order);
}

// ------------------------------------------------------------------
// Get all series (CACHE-FIRST: return cache immediately, sync in background)
// ------------------------------------------------------------------
// Tal como nos filmes, sincronizamos com Firestore no máximo UMA vez por sessão (persistente entre navegações).
const SERIES_SYNC_FLAG_KEY = "hasSyncedSeriesFromFirestoreOnce";

export async function getAllSeries(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache immediately (UI instantânea)
  const local = await storageService.get(SERIES_KEY, []);
  const result = Array.isArray(local) ? local : [];

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return result;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(SERIES_SYNC_FLAG_KEY) === "true";

  // Sync com Firestore em background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(SERIES_SYNC_FLAG_KEY, "true");

    getAllSeriesFirestore().then(async (cloud) => {
      if (Array.isArray(cloud) && cloud.length > 0) {
        await saveCacheSeries(cloud);
        document.dispatchEvent(new CustomEvent("seriesDataSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
      }
    }).catch(err => {
      if (!err.code || err.code !== 'permission-denied') {
        console.warn("seriesDataManager.getAllSeries: Firestore sync failed (using cache):", err);
      }
    });
  }

  return result;
}

// ------------------------------------------------------------------
// Save a full series list (updates cache and attempts to push to Firestore)
// ------------------------------------------------------------------
export async function saveSeries(seriesList) {
  // update local cache immediately
  await saveCacheSeries(seriesList);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // try to push each series to Firestore (best-effort, don't throw)
  try {
    if (Array.isArray(seriesList)) {
      for (const s of seriesList) {
        if (!s || !s.id) continue;
        try {
          await saveSerieFirestore(s);
        } catch (err) {
          // don't fail the whole operation on single error
          console.warn("seriesDataManager.saveSeries: failed to save serie to Firestore", s.id, err);
        }
      }
    }
  } catch (err) {
    console.warn("seriesDataManager.saveSeries: Firestore update failed:", err);
  }
}

// ------------------------------------------------------------------
// Add a serie: write to Firestore (if possible) then update cache & order
// ------------------------------------------------------------------
export async function addSerie(newSerie) {
  if (!newSerie) throw new Error("Invalid serie");

  // update cache first for instant UI feedback
  const current = await storageService.get(SERIES_KEY, []);
  const list = Array.isArray(current) ? [...current, newSerie] : [newSerie];
  await saveCacheSeries(list);

  // update order cache
  let order = await storageService.get(SERIES_ORDER_KEY, []);
  order = Array.isArray(order) ? order : [];
  if (!order.includes(newSerie.id)) {
    order.push(newSerie.id);
    await saveCacheOrder(order);
  }

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // best-effort: save to Firestore
    try {
      await saveSerieFirestore(newSerie);
      try {
        // update order in Firestore (read-modify-write)
        const cloudOrder = await getSeriesOrderFirestore();
        const finalOrder = Array.isArray(cloudOrder) ? cloudOrder.slice() : [];
        if (!finalOrder.includes(newSerie.id)) finalOrder.push(newSerie.id);
        await saveSeriesOrderFirestore(finalOrder);
      } catch (err) {
        console.warn("seriesDataManager.addSerie: could not update series_order in Firestore:", err);
      }
    } catch (err) {
      console.warn("seriesDataManager.addSerie: could not save serie to Firestore (offline or permissions):", err);
    }
  }

  // ✅ Criar progresso inicial: série começa sem episódios vistos
  const initialProgress = { watched: {} };
  try {
    await updateSerieProgress(newSerie.id, initialProgress);
  } catch (err) {
    console.warn("seriesDataManager.addSerie: failed to initialize progress:", err);
  }
}

// ------------------------------------------------------------------
// Update serie
// ------------------------------------------------------------------
export async function updateSerie(updated) {
  if (!updated || !updated.id) return;

  // update cache
  const series = await storageService.get(SERIES_KEY, []);
  const list = Array.isArray(series) ? series.map(s => s.id === updated.id ? { ...s, ...updated } : s) : [updated];
  await saveCacheSeries(list);

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // try update Firestore
    try {
      await saveSerieFirestore(updated);
    } catch (err) {
      console.warn("seriesDataManager.updateSerie: failed to update Firestore:", err);
    }
  }
}

// ------------------------------------------------------------------
// Delete serie
// ------------------------------------------------------------------
export async function deleteSerie(id) {
  if (!id) return;

  // remove from cache
  let series = await storageService.get(SERIES_KEY, []);
  series = Array.isArray(series) ? series.filter(s => s.id !== id) : [];
  await saveCacheSeries(series);

  // remove from order cache
  let order = await storageService.get(SERIES_ORDER_KEY, []);
  order = Array.isArray(order) ? order.filter(sid => sid !== id) : [];
  await saveCacheOrder(order);

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // try remove from Firestore
    try {
      await deleteSerieFirestore(id);
      // also try to remove from cloud order
      try {
        const cloudOrder = await getSeriesOrderFirestore();
        if (Array.isArray(cloudOrder) && cloudOrder.includes(id)) {
          const newOrder = cloudOrder.filter(sid => sid !== id);
          await saveSeriesOrderFirestore(newOrder);
        }
      } catch (err) {
        console.warn("seriesDataManager.deleteSerie: could not update series_order in Firestore:", err);
      }
    } catch (err) {
      console.warn("seriesDataManager.deleteSerie: could not delete from Firestore (offline or permissions):", err);
    }
  }

  // Clean up progress (local cache and Firestore)
  try {
    await deleteSerieProgress(id);
  } catch (err) {
    console.warn("seriesDataManager.deleteSerie: failed to delete progress:", err);
  }
}

// ------------------------------------------------------------------
// Get by id (tries cache first then cloud fallback)
// ------------------------------------------------------------------
export async function getSerieById(id) {
  if (!id) return null;
  const all = await getAllSeries({ syncFromCloud: false });
  return all.find(s => s.id === id) || null;
}

// ------------------------------------------------------------------
// Series order helpers
// ------------------------------------------------------------------
// Para evitar múltiplas leituras de ordem por sessão,
// sincronizamos com Firestore no máximo UMA vez (persistente entre navegações).
const SERIES_ORDER_SYNC_FLAG_KEY = "hasSyncedSeriesOrderFromFirestoreOnce";

export async function getSeriesOrder(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache immediately (UI instantânea)
  const local = await storageService.get(SERIES_ORDER_KEY, []);
  const result = Array.isArray(local) ? local : [];

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return result;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(SERIES_ORDER_SYNC_FLAG_KEY) === "true";

  // Sync with Firestore in background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(SERIES_ORDER_SYNC_FLAG_KEY, "true");

    getSeriesOrderFirestore().then(async (cloud) => {
      if (Array.isArray(cloud) && cloud.length > 0) {
        await saveCacheOrder(cloud);
        // Disparar evento para atualizar UI se necessário
        document.dispatchEvent(new CustomEvent("seriesOrderSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
      }
    }).catch(err => {
      // Only log if it's not a permissions error
      if (!err.code || err.code !== 'permission-denied') {
        console.warn("seriesDataManager.getSeriesOrder: Firestore sync failed (using cache):", err);
      }
    });
  }

  return result;
}

export async function saveSeriesOrder(order) {
  if (!Array.isArray(order)) return;
  // update cache
  await saveCacheOrder(order);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // try saving to Firestore
  try {
    await saveSeriesOrderFirestore(order);
  } catch (err) {
    console.warn("seriesDataManager.saveSeriesOrder: failed to save to Firestore:", err);
  }
}

// default export not used — keep named exports

