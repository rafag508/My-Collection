// src/modules/series/seriesProgress.js
import { storageService } from "../storageService.js";
import { 
  saveSerieProgressFirestore, 
  deleteSerieProgressFirestore,
  getSerieProgressFirestore,
  getAllSeriesProgressFirestore
} from "../../firebase/firestore.js";
import { isGuestMode } from "../guestMode.js";

const PROGRESS_KEY = "series_progress";

export async function loadProgress() {
  return await storageService.get(PROGRESS_KEY, {});
}

export async function saveProgress(progress) {
  await storageService.set(PROGRESS_KEY, progress);
}

export async function getSerieProgress(serieId) {
  const allLocal = await loadProgress();
  const local = allLocal[serieId];
  
  // Em modo convidado, usar apenas cache local
  if (isGuestMode()) {
    if (local) {
      return JSON.parse(JSON.stringify(local)); // Deep copy
    }
    return { watched: {}, lastUpdated: Date.now() };
  }
  
  let cloud = null;
  try {
    cloud = await getSerieProgressFirestore(serieId);
  } catch (err) {
    console.warn("seriesProgress.getSerieProgress: Cloud read failed, falling back to local:", err);
  }
  
  // Se só existe local, usar local
  if (local && !cloud) {
    console.log(`[getSerieProgress] ${serieId}: Apenas local existe`, local.watched);
    return JSON.parse(JSON.stringify(local)); // Deep copy
  }
  
  // Se só existe cloud, usar cloud e atualizar local
  if (!local && cloud) {
    console.log(`[getSerieProgress] ${serieId}: Apenas cloud existe, atualizando local`, cloud.watched);
    allLocal[serieId] = cloud;
    await saveProgress(allLocal);
    return cloud;
  }
  
  // Se nenhum existe
  if (!local && !cloud) {
    console.log(`[getSerieProgress] ${serieId}: Nenhum dado existe`);
    return { watched: {}, lastUpdated: Date.now() };
  }
  
  // Se ambos existem, usar o mais recente (não fazer merge que favorece TRUE)
  const localTime = local.lastUpdated || 0;
  const cloudTime = cloud.lastUpdated || 0;
  
  console.log(`[getSerieProgress] ${serieId}: Ambos existem - localTime: ${localTime}, cloudTime: ${cloudTime}`);
  console.log(`[getSerieProgress] ${serieId}: Local watched:`, local.watched);
  console.log(`[getSerieProgress] ${serieId}: Cloud watched:`, cloud.watched);
  
  if (localTime >= cloudTime) {
    // Local é mais recente ou igual, usar local
    console.log(`[getSerieProgress] ${serieId}: Usando LOCAL (mais recente ou igual)`);
    return JSON.parse(JSON.stringify(local)); // Deep copy
  } else {
    // Cloud é mais recente, atualizar local e retornar cloud
    console.log(`[getSerieProgress] ${serieId}: Usando CLOUD (mais recente)`);
    allLocal[serieId] = cloud;
    await saveProgress(allLocal);
    return cloud;
  }
}

export async function updateSerieProgress(serieId, data) {
  const allLocal = await loadProgress();
  
  const toSave = {
    watched: data.watched || {},
    lastUpdated: Date.now()
  };
  
  console.log(`[updateSerieProgress] ${serieId}: Salvando com timestamp ${toSave.lastUpdated}`, toSave.watched);
  
  // Salva local
  allLocal[serieId] = toSave;
  await saveProgress(allLocal);
  
  // Verificar se foi salvo corretamente
  const verify = await loadProgress();
  const saved = verify[serieId];
  console.log(`[updateSerieProgress] ${serieId}: Verificação - salvo com timestamp ${saved?.lastUpdated}`, saved?.watched);
  
  // Em modo convidado, não sincronizar com Firestore
  if (!isGuestMode()) {
  // Salva cloud (best effort, não bloqueia)
  saveSerieProgressFirestore(serieId, toSave).catch(err => {
    console.warn("seriesProgress.updateSerieProgress: Failed to save cloud progress:", err);
  });
  }
  
  return toSave;
}

export async function toggleEpisodeProgress(serie, serieId, seasonNumber, episodeNumber) {
  const progress = await getSerieProgress(serieId);
  let watchedMap = progress.watched || {};

  const allEpisodes = [];
  serie.seasons.forEach((season) => {
    season.episodes.forEach((_, idx) => {
      allEpisodes.push({ season: season.number, ep: idx + 1 });
    });
  });

  const clickedIndex = allEpisodes.findIndex(
    (e) => e.season === seasonNumber && e.ep === episodeNumber
  );
  
  if (clickedIndex === -1) {
    console.error("Episode not found");
    return progress;
  }

  const key = `${seasonNumber}-${episodeNumber}`;
  const isWatched = !!watchedMap[key];
  
  // Verificar se há episódios marcados DEPOIS do clicado
  let hasWatchedAfter = false;
  for (let i = clickedIndex + 1; i < allEpisodes.length; i++) {
    const ep = allEpisodes[i];
    const epKey = `${ep.season}-${ep.ep}`;
    if (watchedMap[epKey] === true) {
      hasWatchedAfter = true;
      break;
    }
  }

  if (!isWatched) {
    // Episódio não marcado: marca todos até aquele (inclusive)
    for (let i = 0; i <= clickedIndex; i++) {
      const ep = allEpisodes[i];
      watchedMap[`${ep.season}-${ep.ep}`] = true;
    }
  } else {
    // Episódio já está marcado
    if (hasWatchedAfter) {
      // Há episódios marcados depois: desmarca todos os depois, mantém o clicado marcado
      const newMap = {};
      for (let i = 0; i <= clickedIndex; i++) {
        const ep = allEpisodes[i];
        const epKey = `${ep.season}-${ep.ep}`;
        if (watchedMap[epKey] === true) {
          newMap[epKey] = true;
        }
      }
      watchedMap = newMap;
    } else {
      // Não há episódios marcados depois: desmarca só o episódio clicado
      const newMap = {};
      for (const k in watchedMap) {
        if (watchedMap.hasOwnProperty(k) && k !== key && watchedMap[k] === true) {
          newMap[k] = true;
        }
      }
      watchedMap = newMap;
    }
  }

  return await updateSerieProgress(serieId, { watched: watchedMap });
}

export function countWatchedEpisodes(serie, progress) {
  const total = serie.seasons.reduce((a, s) => a + s.episodes.length, 0);
  const watched = Object.values(progress.watched || {}).filter(Boolean).length;
  return { watched, total };
}

export async function markSerieAsViewed(serieId, serie) {
  const map = {};
  serie.seasons.forEach(season => {
    season.episodes.forEach((_, i) => {
      map[`${season.number}-${i + 1}`] = true;
    });
  });
  return await updateSerieProgress(serieId, { watched: map });
}

export async function unmarkSerieAsViewed(serieId) {
  return await updateSerieProgress(serieId, { watched: {} });
}

/**
 * Check if a serie is completely watched (all episodes watched)
 * @param {Object} serie - The serie object with seasons and episodes
 * @param {Object} progress - The progress object from getSerieProgress()
 * @returns {boolean} - True if all episodes are watched
 */
export function isSerieCompletelyWatched(serie, progress) {
  if (!serie || !serie.seasons || !progress || !progress.watched) return false;
  
  const watchedMap = progress.watched || {};
  let totalEpisodes = 0;
  let watchedEpisodes = 0;
  
  serie.seasons.forEach((season) => {
    season.episodes.forEach((_, i) => {
      totalEpisodes++;
      const key = `${season.number}-${i + 1}`;
      if (watchedMap[key]) watchedEpisodes++;
    });
  });
  
  return totalEpisodes > 0 && watchedEpisodes === totalEpisodes;
}

// Para evitar múltiplas leituras completas de progresso por sessão,
// sincronizamos com Firestore no máximo UMA vez (persistente entre navegações).
const SERIES_PROGRESS_SYNC_FLAG_KEY = "hasSyncedSeriesProgressFromFirestoreOnce";

/**
 * Obtém todo o progresso das séries (cache-first com sync em background)
 * Similar a getAllWatchedStates() para movies, mas retorna o objeto completo de progresso
 */
export async function getAllSeriesProgress(options = {}) {
  const { syncFromCloud = true } = options;

  // Return cache imediatamente (UI instantânea)
  const progress = await loadProgress();

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return progress;
  }

  // Verificar flag em sessionStorage (persiste entre navegações)
  const hasSynced = sessionStorage.getItem(SERIES_PROGRESS_SYNC_FLAG_KEY) === "true";

  // Sync com Firestore em background (não bloqueia), mas no máximo 1x por sessão
  if (syncFromCloud && !hasSynced) {
    sessionStorage.setItem(SERIES_PROGRESS_SYNC_FLAG_KEY, "true");

    getAllSeriesProgressFirestore().then(async (cloud) => {
    if (cloud && Object.keys(cloud).length > 0) {
      // Update local cache
      await saveProgress(cloud);
        // Disparar evento para atualizar UI se necessário
        document.dispatchEvent(new CustomEvent("seriesProgressSynced", { 
          detail: { source: "firestore", data: cloud } 
        }));
    }
    }).catch(err => {
      console.warn("seriesProgress.getAllSeriesProgress: Firestore sync failed (using cache):", err);
    });
  }
  
  return progress;
}

export async function deleteSerieProgress(serieId) {
  // Remove from local cache
  const progress = await loadProgress();
  delete progress[serieId];
  await saveProgress(progress);

  // Em modo convidado, não sincronizar com Firestore
  if (isGuestMode()) {
    return;
  }

  // Try to delete from Firestore (best-effort)
  try {
    await deleteSerieProgressFirestore(serieId);
  } catch (err) {
    console.warn("seriesProgress.deleteSerieProgress: failed to delete from Firestore:", err);
  }
}

