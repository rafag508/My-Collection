// src/modules/movies/moviesProgress.js
import { storageService } from "../storageService.js";
import {
  saveMovieProgressFirestore,
  getMovieProgressFirestore,
  getAllMoviesProgressFirestore,
  deleteMovieProgressFirestore
} from "../../firebase/firestore.js";
import { isGuestMode } from "../guestMode.js";

const PROGRESS_KEY = "movies_progress";

export async function loadProgress() {
  return await storageService.get(PROGRESS_KEY, {});
}

export async function saveProgress(progress) {
  await storageService.set(PROGRESS_KEY, progress);
}

export async function getMovieProgress(movieId) {
  // Em modo convidado, usar apenas cache local
  if (isGuestMode()) {
    const progress = await loadProgress();
    return progress[movieId] || { watched: false };
  }

  // Try Firestore first, then fallback to local
  try {
    const cloud = await getMovieProgressFirestore(movieId);
    if (cloud && cloud.watched !== undefined) {
      // Update local cache
      const local = await loadProgress();
      local[movieId] = cloud;
      await saveProgress(local);
      return cloud;
    }
  } catch (err) {
    console.warn("moviesProgress.getMovieProgress: Firestore read failed, using cache:", err);
  }
  
  const progress = await loadProgress();
  return progress[movieId] || { watched: false };
}

export async function updateMovieProgress(movieId, data) {
  // Update local cache immediately
  const progress = await loadProgress();
  progress[movieId] = data;
  await saveProgress(progress);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // Try to save to Firestore (best-effort)
  try {
    await saveMovieProgressFirestore(movieId, data);
  } catch (err) {
    console.warn("moviesProgress.updateMovieProgress: failed to save to Firestore:", err);
  }
}

export async function markMovieAsViewed(movieId) {
  await updateMovieProgress(movieId, { watched: true });
}

export async function unmarkMovieAsViewed(movieId) {
  await updateMovieProgress(movieId, { watched: false });
}

export async function toggleMovieWatched(movieId) {
  const progress = await getMovieProgress(movieId);
  const isWatched = progress.watched || false;

  if (isWatched) {
    await unmarkMovieAsViewed(movieId);
  } else {
    await markMovieAsViewed(movieId);
  }

  return !isWatched;
}

// Para evitar múltiplas leituras completas de progresso por sessão,
// sincronizamos com Firestore no máximo UMA vez (persistente entre navegações).
const MOVIES_PROGRESS_SYNC_FLAG_KEY = "hasSyncedMoviesProgressFromFirestoreOnce";

export async function getAllWatchedStates(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache imediatamente (UI instantânea)
  const progress = await loadProgress();
  const watched = {};
  for (const [movieId, data] of Object.entries(progress)) {
    watched[movieId] = data.watched || false;
  }

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return watched;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(MOVIES_PROGRESS_SYNC_FLAG_KEY) === "true";

  // Sync com Firestore em background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(MOVIES_PROGRESS_SYNC_FLAG_KEY, "true");

    getAllMoviesProgressFirestore().then(async (cloud) => {
      if (cloud && Object.keys(cloud).length > 0) {
        // Update local cache
        await saveProgress(cloud);
        // Disparar evento para atualizar UI se necessário
        document.dispatchEvent(new CustomEvent("moviesProgressSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
      }
    }).catch(err => {
      console.warn("moviesProgress.getAllWatchedStates: Firestore sync failed (using cache):", err);
    });
  }

  return watched;
}

export async function deleteMovieProgress(movieId) {
  // Remove from local cache
  const progress = await loadProgress();
  delete progress[movieId];
  await saveProgress(progress);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // Try to delete from Firestore (best-effort)
  try {
    await deleteMovieProgressFirestore(movieId);
  } catch (err) {
    console.warn("moviesProgress.deleteMovieProgress: failed to delete from Firestore:", err);
  }
}

