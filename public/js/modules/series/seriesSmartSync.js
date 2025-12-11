// js/modules/series/seriesSmartSync.js
// 🔄 SISTEMA HÍBRIDO DE SINCRONIZAÇÃO INTELIGENTE v2.0

import { syncSerieFromTMDB } from "./seriesSync.js";
import { getAllSeries } from "./seriesDataManager.js";
import { getAllSeriesProgress } from "./seriesProgress.js";
import { storageService } from "../storageService.js";
import { isGuestMode } from "../guestMode.js";

// Chaves de cache
const SYNC_CACHE_KEY = "series_sync_cache";
const ACTIVE_STATUSES = ["On Display", "Returning Series", "In Production", "Returning"];
const ENDED_STATUS = "Ended";

// Intervalos
const ACTIVE_SYNC_INTERVAL = 0; // Sempre para ativas (respeitando throttling)
const ENDED_SYNC_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 dias para terminadas
// Para reduzir consumo, fazemos throttling global de 1 dia
const MIN_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 1 dia
const REQUEST_DELAY = 1000; // 1 segundo entre pedidos

// Retry config
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 segundos

/**
 * Calcula prioridade de sincronização baseada no interesse do utilizador
 * Prioridade maior = sincronizar primeiro
 */
function calculateSyncPriority(serie, progress, syncCache) {
  const status = serie.status || "";
  const isActive = ACTIVE_STATUSES.some(s => status.includes(s));
  const isEnded = status === ENDED_STATUS;
  
  // Progresso do utilizador
  const serieProgress = progress[serie.id] || { watched: {} };
  const watchedCount = Object.values(serieProgress.watched || {}).filter(Boolean).length;
  const totalEpisodes = serie.seasons?.reduce((sum, s) => sum + (s.episodes?.length || 0), 0) || 0;
  const watchPercentage = totalEpisodes > 0 ? watchedCount / totalEpisodes : 0;
  
  // Prioridade base
  let priority = 0;
  
  // 1. Séries ativas com progresso parcial (alta prioridade)
  if (isActive && watchPercentage > 0 && watchPercentage < 1) {
    priority = 100 + watchPercentage * 50; // 100-150
  }
  // 2. Séries ativas sem progresso (média prioridade)
  else if (isActive && watchPercentage === 0) {
    priority = 50;
  }
  // 3. Séries ativas completamente vistas (baixa prioridade, mas ainda sincronizar)
  else if (isActive && watchPercentage === 1) {
    priority = 25;
  }
  // 4. Séries terminadas com progresso (muito baixa prioridade)
  else if (isEnded && watchPercentage > 0) {
    priority = 10;
  }
  // 5. Séries terminadas sem progresso (prioridade mínima)
  else if (isEnded) {
    priority = 1;
  }
  // 6. Séries sem status (tratar como ativas)
  else {
    priority = watchPercentage > 0 ? 75 : 40;
  }
  
  // Ajuste: séries nunca sincronizadas têm boost
  const cacheEntry = syncCache[serie.id];
  if (!cacheEntry || !cacheEntry.lastSync) {
    priority += 20;
  }
  
  return priority;
}

/**
 * Verifica se uma série precisa de sincronização
 */
function shouldSyncSerie(serie, syncCache) {
  const cacheEntry = syncCache[serie.id];
  const status = serie.status || "";
  const isActive = ACTIVE_STATUSES.some(s => status.includes(s));
  const isEnded = status === ENDED_STATUS;
  
  // Throttling global: não sincronizar se já sincronizou há menos de 1 hora
  if (cacheEntry?.lastSync) {
    const timeSinceSync = Date.now() - cacheEntry.lastSync;
    if (timeSinceSync < MIN_SYNC_INTERVAL) {
      return false; // Throttling ativo
    }
  }
  
  // Séries sem status → tratar como ativas
  if (!isActive && !isEnded) {
    return true;
  }
  
  // Séries ativas → sempre sincronizar (respeitando throttling)
  if (isActive) {
    return true;
  }
  
  // Séries terminadas → verificar intervalo de 30 dias
  if (isEnded) {
    if (!cacheEntry || !cacheEntry.lastSync) {
      return true;
    }
    const timeSinceSync = Date.now() - cacheEntry.lastSync;
    return timeSinceSync >= ENDED_SYNC_INTERVAL;
  }
  
  return false;
}

/**
 * Atualiza cache de sincronização
 */
async function updateSyncCache(serieId, status, success = true) {
  const cache = await storageService.get(SYNC_CACHE_KEY, {});
  cache[serieId] = {
    lastSync: Date.now(),
    status: status,
    lastSuccess: success ? Date.now() : cache[serieId]?.lastSuccess,
    retryCount: success ? 0 : (cache[serieId]?.retryCount || 0) + 1
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
 * Sincroniza uma série com retry
 */
async function syncSerieWithRetry(serie, retries = 0) {
  try {
    const result = await syncSerieFromTMDB(serie.id);
    
    // Atualizar cache com novo status
    const updatedSeries = await getAllSeries();
    const currentSerie = updatedSeries.find(s => s.id === serie.id);
    const newStatus = currentSerie?.status || serie.status;
    
    await updateSyncCache(serie.id, newStatus, result.updated);
    
    return { ...result, serie: currentSerie || serie };
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`  ⚠️ Retry ${retries + 1}/${MAX_RETRIES} para ${serie.title}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retries + 1)));
      return syncSerieWithRetry(serie, retries + 1);
    }
    throw err;
  }
}

/**
 * 🔄 Sincronização inteligente com priorização
 */
export async function smartSyncAllSeries(options = {}) {
  // Não sincronizar em modo convidado
  if (isGuestMode()) {
    console.log("ℹ️ Modo convidado: sincronização desativada");
    return { synced: 0, skipped: 0, errors: 0 };
  }
  
  const {
    prioritizeVisible = false,
    visibleSeriesIds = [],
    maxConcurrent = 1 // Por padrão, sequencial (1 req/seg)
  } = options;
  
  console.log("🔄 Iniciando sincronização inteligente v2.0...");
  
  const [allSeries, progress, syncCache] = await Promise.all([
    getAllSeries(),
    getAllSeriesProgress({ syncFromCloud: false }), // Sync já foi feito pela página
    storageService.get(SYNC_CACHE_KEY, {})
  ]);
  
  if (!Array.isArray(allSeries) || allSeries.length === 0) {
    const result = { synced: 0, skipped: 0, errors: 0 };
    console.log("  ℹ️ Nenhuma série encontrada");
    // Guardar timestamp global mesmo quando não há séries
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  // Filtrar séries que precisam de sincronização
  const seriesToSync = allSeries
    .filter(serie => shouldSyncSerie(serie, syncCache))
    .map(serie => ({
      serie,
      priority: calculateSyncPriority(serie, progress, syncCache)
    }))
    .sort((a, b) => b.priority - a.priority); // Maior prioridade primeiro
  
  // Se priorizar visíveis, mover séries visíveis para o topo
  if (prioritizeVisible && visibleSeriesIds.length > 0) {
    seriesToSync.forEach((item, index) => {
      if (visibleSeriesIds.includes(item.serie.id)) {
        item.priority = 1000 + item.priority; // Boost enorme
      }
    });
    seriesToSync.sort((a, b) => b.priority - a.priority);
  }
  
  const seriesToSkip = allSeries.length - seriesToSync.length;
  
  console.log(`  📊 Total: ${allSeries.length} | A sincronizar: ${seriesToSync.length} | A ignorar: ${seriesToSkip}`);
  
  if (seriesToSync.length === 0) {
    const result = { synced: 0, skipped: seriesToSkip, errors: 0 };
    console.log("  ✅ Todas as séries estão atualizadas!");
    // Guardar timestamp global mesmo quando não há nada para sincronizar
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  let synced = 0;
  let errors = 0;
  const results = [];
  
  // Sincronizar com delay e retry
  for (let i = 0; i < seriesToSync.length; i++) {
    const { serie } = seriesToSync[i];
    try {
      const status = serie.status || "sem status";
      const priority = calculateSyncPriority(serie, progress, syncCache);
      
      console.log(`  🔄 [P${priority.toFixed(0)}] ${serie.title} (${status})`);
      
      const result = await syncSerieWithRetry(serie);
      results.push(result);
      
      if (result.updated) {
        synced++;
        if (result.addedEpisodes > 0) {
          console.log(`    ✅ ${result.addedEpisodes} novos episódios!`);
        }
      }
      
      // Delay entre pedidos (1 segundo)
      if (i < seriesToSync.length - 1) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    } catch (err) {
      console.error(`    ❌ Erro: ${serie.title}`, err);
      await updateSyncCache(serie.id, serie.status, false);
      errors++;
    }
  }
  
  const result = { synced, skipped: seriesToSkip, errors, results };
  console.log(`✅ Concluído: ${synced} atualizadas, ${seriesToSkip} ignoradas, ${errors} erros`);
  
  // Atualizar timestamp global
  await updateGlobalSyncTimestamp(result);
  
  return result;
}

/**
 * 🔄 Sincronização rápida apenas de séries ativas (otimizada)
 */
export async function smartSyncActiveSeries(options = {}) {
  // Não sincronizar em modo convidado
  if (isGuestMode()) {
    console.log("ℹ️ Modo convidado: sincronização desativada");
    return { synced: 0, skipped: 0, errors: 0 };
  }
  
  const { prioritizeVisible = false, visibleSeriesIds = [] } = options;
  
  console.log("🔄 Sincronizando séries ativas...");
  
  const [allSeries, progress, syncCache] = await Promise.all([
    getAllSeries(),
    getAllSeriesProgress({ syncFromCloud: false }), // Sync já foi feito pela página
    storageService.get(SYNC_CACHE_KEY, {})
  ]);
  
  if (!Array.isArray(allSeries) || allSeries.length === 0) {
    const result = { synced: 0, skipped: 0, errors: 0 };
    // Guardar timestamp global mesmo quando não há séries
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  // Filtrar apenas séries ativas que precisam de sync
  const activeSeries = allSeries
    .filter(serie => {
      const status = serie.status || "";
      const isActive = ACTIVE_STATUSES.some(s => status.includes(s)) || !status;
      return isActive && shouldSyncSerie(serie, syncCache);
    })
    .map(serie => ({
      serie,
      priority: calculateSyncPriority(serie, progress, syncCache)
    }))
    .sort((a, b) => b.priority - a.priority);
  
  // Priorizar visíveis
  if (prioritizeVisible && visibleSeriesIds.length > 0) {
    activeSeries.forEach(item => {
      if (visibleSeriesIds.includes(item.serie.id)) {
        item.priority = 1000 + item.priority;
      }
    });
    activeSeries.sort((a, b) => b.priority - a.priority);
  }
  
  console.log(`  📊 Séries ativas a sincronizar: ${activeSeries.length} de ${allSeries.length} total`);
  
  if (activeSeries.length === 0) {
    const result = { synced: 0, skipped: allSeries.length, errors: 0 };
    console.log("  ✅ Todas as séries ativas estão atualizadas!");
    // Guardar timestamp global mesmo quando não há nada para sincronizar
    await updateGlobalSyncTimestamp(result);
    return result;
  }
  
  let synced = 0;
  let errors = 0;
  
  for (let i = 0; i < activeSeries.length; i++) {
    const { serie } = activeSeries[i];
    try {
      const result = await syncSerieWithRetry(serie);
      if (result.updated) {
        synced++;
      }
      
      if (i < activeSeries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    } catch (err) {
      console.error(`  ❌ Erro: ${serie.title}`, err);
      errors++;
    }
  }
  
  const result = { synced, skipped: allSeries.length - activeSeries.length, errors };
  console.log(`✅ Séries ativas: ${synced} atualizadas, ${errors} erros`);
  
  // Atualizar timestamp global
  await updateGlobalSyncTimestamp(result);
  
  return result;
}

/**
 * Limpar cache de sincronização
 */
export async function clearSyncCache() {
  await storageService.remove(SYNC_CACHE_KEY);
  console.log("🗑️ Cache de sincronização limpo");
}

/**
 * Obter estatísticas de sincronização
 */
export async function getSyncStats() {
  const [allSeries, syncCache] = await Promise.all([
    getAllSeries(),
    storageService.get(SYNC_CACHE_KEY, {})
  ]);
  
  const stats = {
    total: allSeries.length,
    active: 0,
    ended: 0,
    neverSynced: 0,
    syncedRecently: 0,
    needsSync: 0
  };
  
  const now = Date.now();
  const fiveMinutesAgo = now - MIN_SYNC_INTERVAL;
  
  for (const serie of allSeries) {
    const status = serie.status || "";
    const isActive = ACTIVE_STATUSES.some(s => status.includes(s));
    const isEnded = status === ENDED_STATUS;
    
    if (isActive) stats.active++;
    if (isEnded) stats.ended++;
    
    const cacheEntry = syncCache[serie.id];
    if (!cacheEntry || !cacheEntry.lastSync) {
      stats.neverSynced++;
    } else if (cacheEntry.lastSync > fiveMinutesAgo) {
      stats.syncedRecently++;
    }
    
    if (shouldSyncSerie(serie, syncCache)) {
      stats.needsSync++;
    }
  }
  
  return stats;
}

