// src/modules/movies/moviesDataManager.js
// Now uses Firestore as primary storage and localStorage as a cache.
// Behavior:
// - read: try Firestore -> if success save cache and return; if failure fallback to cache
// - write (add/update/delete/saveOrder): try Firestore, always update cache locally so UI updates instantly

import { storageService } from "../storageService.js";
import {
  getAllMoviesFirestore,
  saveMovieFirestore,
  deleteMovieFirestore,
  getMoviesOrderFirestore,
  saveMoviesOrderFirestore
} from "../../firebase/firestore.js";
import { updateMovieProgress, deleteMovieProgress } from "./moviesProgress.js";
import { isGuestMode } from "../guestMode.js";

const MOVIES_KEY = "movies";
const ORDER_KEY = "movies_order";

// Helper: save to local cache (no network)
async function saveCacheMovies(moviesList) {
  await storageService.set(MOVIES_KEY, moviesList);
}

async function saveCacheOrder(order) {
  await storageService.set(ORDER_KEY, order);
}

// ------------------------------------------------------------------
// Get all movies (CACHE-FIRST: return cache immediately, sync in background)
// ------------------------------------------------------------------
// Para evitar leituras duplicadas, sincronizamos com Firestore no máximo
// UMA vez por sessão (persistente entre navegações). As restantes chamadas usam apenas cache/localStorage.
const MOVIES_SYNC_FLAG_KEY = "hasSyncedMoviesFromFirestoreOnce";

export async function getAllMovies(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache immediately (UI instantânea)
  const local = await storageService.get(MOVIES_KEY, []);
  const result = Array.isArray(local) ? local : [];

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return result;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(MOVIES_SYNC_FLAG_KEY) === "true";

  // Sync with Firestore em background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(MOVIES_SYNC_FLAG_KEY, "true");

    getAllMoviesFirestore().then(async (cloud) => {
      if (Array.isArray(cloud) && cloud.length > 0) {
        await saveCacheMovies(cloud);
        // Disparar evento para atualizar UI se necessário
        document.dispatchEvent(new CustomEvent("moviesDataSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
      }
    }).catch(err => {
      // Only log if it's not a permissions error
      if (!err.code || err.code !== 'permission-denied') {
        console.warn("moviesDataManager.getAllMovies: Firestore sync failed (using cache):", err);
      }
    });
  }

  return result;
}

// ------------------------------------------------------------------
// Save a full movies list (updates cache and attempts to push to Firestore)
// ------------------------------------------------------------------
export async function saveMovies(moviesList) {
  // update local cache immediately
  await saveCacheMovies(moviesList);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // try to push each movie to Firestore (best-effort, don't throw)
  try {
    if (Array.isArray(moviesList)) {
      // ✅ MELHORIA: Fazer writes em paralelo (limitado para não sobrecarregar)
      const BATCH_SIZE = 10;
      for (let i = 0; i < moviesList.length; i += BATCH_SIZE) {
        const batch = moviesList.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (m) => {
            if (!m || !m.id) return;
            try {
              await saveMovieFirestore(m);
            } catch (err) {
              // don't fail the whole operation on single error
              console.warn("moviesDataManager.saveMovies: failed to save movie to Firestore", m.id, err);
            }
          })
        );
      }
    }
  } catch (err) {
    console.warn("moviesDataManager.saveMovies: Firestore update failed:", err);
  }
}

// ------------------------------------------------------------------
// Add a movie: write to Firestore (if possible) then update cache & order
// ------------------------------------------------------------------
export async function addMovie(newMovie) {
  if (!newMovie) throw new Error("Invalid movie");

  // update cache first for instant UI feedback
  const current = await storageService.get(MOVIES_KEY, []);
  const list = Array.isArray(current) ? [...current, newMovie] : [newMovie];
  await saveCacheMovies(list);

  // update order cache
  let order = await storageService.get(ORDER_KEY, []);
  order = Array.isArray(order) ? order : [];
  if (!order.includes(newMovie.id)) {
    order.push(newMovie.id);
    await saveCacheOrder(order);
  }

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // best-effort: save to Firestore (fazer writes em paralelo quando possível)
    try {
      const promises = [
        saveMovieFirestore(newMovie),
        (async () => {
          try {
            // update order in Firestore (read-modify-write)
            const cloudOrder = await getMoviesOrderFirestore();
            const finalOrder = Array.isArray(cloudOrder) ? cloudOrder.slice() : [];
            if (!finalOrder.includes(newMovie.id)) finalOrder.push(newMovie.id);
            await saveMoviesOrderFirestore(finalOrder);
          } catch (err) {
            console.warn("moviesDataManager.addMovie: could not update movies_order in Firestore:", err);
          }
        })()
      ];

      await Promise.all(promises.map(p => p.catch(err => {
        console.warn("moviesDataManager.addMovie: Firestore write failed:", err);
      })));
    } catch (err) {
      console.warn("moviesDataManager.addMovie: could not save movie to Firestore (offline or permissions):", err);
    }
  }

  // ✅ Criar progresso inicial: filme começa como "não visto"
  const initialProgress = { watched: false };
  try {
    await updateMovieProgress(newMovie.id, initialProgress);
  } catch (err) {
    console.warn("moviesDataManager.addMovie: failed to initialize progress:", err);
  }
}

// ------------------------------------------------------------------
// Update movie
// ------------------------------------------------------------------
export async function updateMovie(updated) {
  if (!updated || !updated.id) return;

  // update cache first (instant UI feedback)
  const movies = await storageService.get(MOVIES_KEY, []);
  const list = Array.isArray(movies) 
    ? movies.map(m => m.id === updated.id ? { ...m, ...updated } : m) 
    : [updated];
  await saveCacheMovies(list);

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // try update Firestore (only the specific movie, not all movies!)
    try {
      await saveMovieFirestore(updated);
    } catch (err) {
      console.warn("moviesDataManager.updateMovie: failed to update Firestore:", err);
    }
  }
}

// ------------------------------------------------------------------
// Delete movie
// ------------------------------------------------------------------
export async function removeMovie(id) {
  if (!id) return;

  // remove from cache first
  let movies = await storageService.get(MOVIES_KEY, []);
  movies = Array.isArray(movies) ? movies.filter(m => m.id !== id) : [];
  await saveCacheMovies(movies);

  // remove from order cache
  let order = await storageService.get(ORDER_KEY, []);
  order = Array.isArray(order) ? order.filter(mid => mid !== id) : [];
  await saveCacheOrder(order);

  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
    // try remove from Firestore
    try {
      await deleteMovieFirestore(id);
      // also try to remove from cloud order
      try {
        const cloudOrder = await getMoviesOrderFirestore();
        if (Array.isArray(cloudOrder) && cloudOrder.includes(id)) {
          const newOrder = cloudOrder.filter(mid => mid !== id);
          await saveMoviesOrderFirestore(newOrder);
        }
      } catch (err) {
        console.warn("moviesDataManager.removeMovie: could not update movies_order in Firestore:", err);
      }
    } catch (err) {
      console.warn("moviesDataManager.removeMovie: could not delete from Firestore (offline or permissions):", err);
    }
  }

  // Clean up progress (local cache and Firestore)
  try {
    await deleteMovieProgress(id);
  } catch (err) {
    console.warn("moviesDataManager.removeMovie: failed to delete progress:", err);
  }
}

// ------------------------------------------------------------------
// Get by id (tries cache first then cloud fallback)
// ------------------------------------------------------------------
export async function getMovieById(id) {
  if (!id) return null;
  const all = await getAllMovies({ syncFromCloud: false });
  return all.find(m => m.id === id) || null;
}

// ------------------------------------------------------------------
// Movies order helpers
// ------------------------------------------------------------------
// Para evitar múltiplas leituras de ordem por sessão,
// sincronizamos com Firestore no máximo UMA vez (persistente entre navegações).
const MOVIES_ORDER_SYNC_FLAG_KEY = "hasSyncedMoviesOrderFromFirestoreOnce";

export async function getMoviesOrder(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache immediately (UI instantânea)
  const local = await storageService.get(ORDER_KEY, []);
  const result = Array.isArray(local) ? local : [];

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return result;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(MOVIES_ORDER_SYNC_FLAG_KEY) === "true";

  // Sync with Firestore in background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(MOVIES_ORDER_SYNC_FLAG_KEY, "true");

    getMoviesOrderFirestore().then(async (cloud) => {
      if (Array.isArray(cloud) && cloud.length > 0) {
        await saveCacheOrder(cloud);
        // Disparar evento para atualizar UI se necessário
        document.dispatchEvent(new CustomEvent("moviesOrderSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
      }
    }).catch(err => {
      // Only log if it's not a permissions error
      if (!err.code || err.code !== 'permission-denied') {
        console.warn("moviesDataManager.getMoviesOrder: Firestore sync failed (using cache):", err);
      }
    });
  }

  return result;
}

export async function saveMoviesOrder(order) {
  if (!Array.isArray(order)) return;
  // update cache
  await saveCacheOrder(order);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // try saving to Firestore
  try {
    await saveMoviesOrderFirestore(order);
  } catch (err) {
    console.warn("moviesDataManager.saveMoviesOrder: failed to save to Firestore:", err);
  }
}
