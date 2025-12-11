// js/modules/movies/moviesSmartSync.js
// 🔄 SISTEMA HÍBRIDO DE SINCRONIZAÇÃO INTELIGENTE PARA FILMES (Simplificado)

import { syncMovieFromTMDB } from "./moviesSync.js";
import { getAllMovies } from "./moviesDataManager.js";
import { getAllWatchedStates } from "./moviesProgress.js";
import { storageService } from "../storageService.js";
import { isGuestMode } from "../guestMode.js";

// Chaves de cache
const SYNC_CACHE_KEY = "movies_sync_cache";

// Intervalos
// Para simplificar e reduzir chamadas, todos os filmes são sincronizados
// no máximo UMA vez a cada 30 dias.
const MOVIE_SYNC_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 dias
const MIN_SYNC_INTERVAL = 60 * 60 * 1000; // usado apenas para estatísticas "recentes"
const REQUEST_DELAY = 1000; // 1 segundo entre pedidos

// Retry config
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 segundos

/**
 * Verifica se um filme precisa de sincronização
 */
function shouldSyncMovie(movie, watched, syncCache) {
  const cacheEntry = syncCache[movie.id];

  // Se nunca foi sincronizado, precisa de sync
  if (!cacheEntry || !cacheEntry.lastSync) {
    return true;
  }

  // Apenas sincronizar se passaram pelo menos 30 dias desde a última sync
  const timeSinceSync = Date.now() - cacheEntry.lastSync;
  return timeSinceSync >= MOVIE_SYNC_INTERVAL;
}

/**
 * Calcula prioridade de sincronização
 */
function calculatePriority(movie, watched) {
  // Com todos os filmes a sincronizar no máximo 1x/mês,
  // não precisamos de prioridades complexas.
  return 50;
}

/**
 * Atualiza cache de sincronização
 */
async function updateSyncCache(movieId, success = true) {
  const cache = await storageService.get(SYNC_CACHE_KEY, {});
  cache[movieId] = {
    lastSync: Date.now(),
    lastSuccess: success ? Date.now() : cache[movieId]?.lastSuccess,
    retryCount: success ? 0 : (cache[movieId]?.retryCount || 0) + 1
  };
  await storageService.set(SYNC_CACHE_KEY, cache);
}

/**
 * Atualiza timestamp global da última execução do smartSync
 */
async function updateGlobalSyncTimestamp(result) {
  const cache = await storageService.get(SYNC_CACHE_KEY, {});
  cache._global = {
    lastSmartSyncExecution: Date.now(),
    lastSmartSyncResult: {
      synced: result.synced || 0,
      skipped: result.skipped || 0,
      errors: result.errors || 0
    }
  };
  await storageService.set(SYNC_CACHE_KEY, cache);
}

/**
 * Sincroniza um filme com retry
 */
async function syncMovieWithRetry(movie, retries = 0) {
  try {
    const result = await syncMovieFromTMDB(movie.id);
    await updateSyncCache(movie.id, result.updated);
    return result;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`  ⚠️ Retry ${retries + 1}/${MAX_RETRIES} para ${movie.title}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retries + 1)));
      return syncMovieWithRetry(movie, retries + 1);
    }
    throw err;
  }
}

/**
 * 🔄 Sincronização inteligente de todos os filmes
 */
export async function smartSyncAllMovies(options = {}) {
  // Não sincronizar em modo convidado
  if (isGuestMode()) {
    console.log("ℹ️ Modo convidado: sincronização desativada");
    return { synced: 0, skipped: 0, errors: 0 };
  }
  
  const { prioritizeVisible = false, visibleMovieIds = [] } = options;
  
  console.log("🔄 Iniciando sincronização inteligente de filmes...");
  
  const [allMovies, watched, syncCache] = await Promise.all([
    getAllMovies({ syncFromCloud: false }),
    getAllWatchedStates(),
    storageService.get(SYNC_CACHE_KEY, {})
  ]);
  
  if (!Array.isArray(allMovies) || allMovies.length === 0) {
    const result = { synced: 0, skipped: 0, errors: 0 };
    console.log("  ℹ️ Nenhum filme encontrado");
    // Guardar timestamp global mesmo quando não há filmes
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  // Filtrar filmes que precisam de sincronização
  const moviesToSync = allMovies
    .filter(movie => shouldSyncMovie(movie, watched, syncCache))
    .map(movie => ({
      movie,
      priority: calculatePriority(movie, watched)
    }))
    .sort((a, b) => b.priority - a.priority); // Maior prioridade primeiro
  
  // Se priorizar visíveis, mover filmes visíveis para o topo
  if (prioritizeVisible && visibleMovieIds.length > 0) {
    moviesToSync.forEach(item => {
      if (visibleMovieIds.includes(item.movie.id)) {
        item.priority = 1000 + item.priority; // Boost enorme
      }
    });
    moviesToSync.sort((a, b) => b.priority - a.priority);
  }
  
  const moviesToSkip = allMovies.length - moviesToSync.length;
  
  console.log(`  📊 Total: ${allMovies.length} | A sincronizar: ${moviesToSync.length} | A ignorar: ${moviesToSkip}`);
  
  if (moviesToSync.length === 0) {
    const result = { synced: 0, skipped: moviesToSkip, errors: 0 };
    console.log("  ✅ Todos os filmes estão atualizados!");
    // Guardar timestamp global mesmo quando não há nada para sincronizar
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  let synced = 0;
  let errors = 0;
  
  // Sincronizar com delay e retry
  for (let i = 0; i < moviesToSync.length; i++) {
    const { movie } = moviesToSync[i];
    try {
      const priority = calculatePriority(movie, watched);
      const isWatched = watched[movie.id] || false;
      const status = isWatched ? "visto" : "não visto";
      
      console.log(`  🔄 [P${priority}] ${movie.title} (${status})`);
      
      const result = await syncMovieWithRetry(movie);
      
      if (result.updated) {
        synced++;
        console.log(`    ✅ Atualizado!`);
      }
      
      // Delay entre pedidos (1 segundo)
      if (i < moviesToSync.length - 1) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    } catch (err) {
      console.error(`    ❌ Erro: ${movie.title}`, err);
      await updateSyncCache(movie.id, false);
      errors++;
    }
  }
  
  const result = { synced, skipped: moviesToSkip, errors };
  console.log(`✅ Concluído: ${synced} atualizados, ${moviesToSkip} ignorados, ${errors} erros`);
  
  // Atualizar timestamp global
  await updateGlobalSyncTimestamp(result);
  
  return result;
}

/**
 * Limpar cache de sincronização
 */
export async function clearSyncCache() {
  await storageService.remove(SYNC_CACHE_KEY);
  console.log("🗑️ Cache de sincronização de filmes limpo");
}

/**
 * Obter estatísticas de sincronização
 */
export async function getSyncStats() {
  const [allMovies, watched, syncCache] = await Promise.all([
    getAllMovies(),
    getAllWatchedStates(),
    storageService.get(SYNC_CACHE_KEY, {})
  ]);
  
  const stats = {
    total: allMovies.length,
    watched: 0,
    unwatched: 0,
    neverSynced: 0,
    syncedRecently: 0,
    needsSync: 0
  };
  
  const now = Date.now();
  const oneHourAgo = now - MIN_SYNC_INTERVAL;
  
  for (const movie of allMovies) {
    const isWatched = watched[movie.id] || false;
    
    if (isWatched) stats.watched++;
    else stats.unwatched++;
    
    const cacheEntry = syncCache[movie.id];
    if (!cacheEntry || !cacheEntry.lastSync) {
      stats.neverSynced++;
    } else if (cacheEntry.lastSync > oneHourAgo) {
      stats.syncedRecently++;
    }
    
    if (shouldSyncMovie(movie, watched, syncCache)) {
      stats.needsSync++;
    }
  }
  
  return stats;
}

