// =====================================================================
// sync.js — Sincronização Firestore → Local (Refresh Manual)
// Compatível com arquitetura cache-first
//
// ⚠️ AVISO IMPORTANTE:
// - Este ficheiro é para refresh MANUAL apenas
// - NÃO usar automaticamente no arranque da app
// - Os DataManagers (seriesDataManager.js, moviesDataManager.js) já fazem
//   sincronização automática e incremental:
//   - getAllSeries/getAllMovies → sync cloud → local automaticamente
//   - add/update/delete → sync local → cloud automaticamente
//
// Quando usar syncFirestoreToLocal():
// ✅ Primeiro login num novo dispositivo
// ✅ Refresh manual quando utilizador pedir
// ✅ Após problemas de sincronização
// ❌ NUNCA no arranque automático da app
// ❌ NUNCA periodicamente (cria conflitos com sync automático)
// =====================================================================

import { storageService } from "../modules/storageService.js";

// Firestore imports (apenas para leitura)
import {
  getAllSeriesFirestore,
  getAllSeriesProgressFirestore,
  getSeriesOrderFirestore,
  getAllMoviesFirestore,
  getAllMoviesProgressFirestore,
  getMoviesOrderFirestore,
  getNotificationsFirestore,
  deleteSerieFirestore,
  deleteMovieFirestore
} from "./firestore.js";

// Progress imports (apenas para salvar cache)
import { saveProgress as saveSeriesProgress } from "../modules/series/seriesProgress.js";
import { saveProgress as saveMoviesProgress } from "../modules/movies/moviesProgress.js";

// Storage keys
const SERIES_KEY = "series";
const SERIES_ORDER_KEY = "series_order";
const MOVIES_KEY = "movies";
const MOVIES_ORDER_KEY = "movies_order";
const NOTIFICATIONS_KEY = "notifications";

// =====================================================================
// 🔄 FIRESTORE → LOCAL (REFRESH MANUAL)
// =====================================================================
// Puxa dados da cloud para o dispositivo atual (atualiza apenas cache)
//
// ⚠️ Esta função apenas atualiza o cache local.
// ⚠️ NÃO envia dados locais para a cloud.
// ⚠️ Para enviar dados locais → cloud, use as funções dos DataManagers:
//    - addSerie(), updateSerie(), deleteSerie()
//    - addMovie(), updateMovie(), removeMovie()
//    (elas já fazem sync automático)
// =====================================================================

export async function syncFirestoreToLocal() {
  console.log("🔄 Sync: Firestore → local (refresh manual)");

  try {
    // SERIES
    const cloudSeries = await getAllSeriesFirestore();
    if (Array.isArray(cloudSeries) && cloudSeries.length > 0) {
      await storageService.set(SERIES_KEY, cloudSeries);
      console.log(`  ✅ ${cloudSeries.length} séries sincronizadas`);
    }

    const cloudSeriesOrder = await getSeriesOrderFirestore();
    if (Array.isArray(cloudSeriesOrder) && cloudSeriesOrder.length > 0) {
      await storageService.set(SERIES_ORDER_KEY, cloudSeriesOrder);
      console.log(`  ✅ Ordem de séries sincronizada`);
    }

    const cloudSeriesProgress = await getAllSeriesProgressFirestore();
    if (cloudSeriesProgress && Object.keys(cloudSeriesProgress).length > 0) {
      await saveSeriesProgress(cloudSeriesProgress);
      console.log(`  ✅ Progresso de ${Object.keys(cloudSeriesProgress).length} séries sincronizado`);
    }

    // MOVIES
    const cloudMovies = await getAllMoviesFirestore();
    if (Array.isArray(cloudMovies) && cloudMovies.length > 0) {
      await storageService.set(MOVIES_KEY, cloudMovies);
      console.log(`  ✅ ${cloudMovies.length} filmes sincronizados`);
    }

    const cloudMoviesOrder = await getMoviesOrderFirestore();
    if (Array.isArray(cloudMoviesOrder) && cloudMoviesOrder.length > 0) {
      await storageService.set(MOVIES_ORDER_KEY, cloudMoviesOrder);
      console.log(`  ✅ Ordem de filmes sincronizada`);
    }

    const cloudMoviesProgress = await getAllMoviesProgressFirestore();
    if (cloudMoviesProgress && Object.keys(cloudMoviesProgress).length > 0) {
      await saveMoviesProgress(cloudMoviesProgress);
      console.log(`  ✅ Progresso de ${Object.keys(cloudMoviesProgress).length} filmes sincronizado`);
    }

    // NOTIFICATIONS
    try {
      const cloudNotifications = await getNotificationsFirestore();
      if (Array.isArray(cloudNotifications) && cloudNotifications.length > 0) {
        await storageService.set(NOTIFICATIONS_KEY, cloudNotifications);
        console.log(`  ✅ ${cloudNotifications.length} notificações sincronizadas`);
      }
    } catch (err) {
      console.warn("  ⚠️ Falha ao sincronizar notificações:", err);
    }

    console.log("✅ Sync Firestore → local concluído");
  } catch (err) {
    console.error("❌ Erro no sync Firestore → local:", err);
    throw err;
  }
}

// =====================================================================
// 🧼 Funções de limpeza
// =====================================================================

export async function clearFirestoreUserData() {
  console.log("🗑 Limpando dados do Firestore...");
  console.warn("⚠️ ATENÇÃO: Esta operação apaga TODOS os dados do Firestore!");

  try {
    // Series
    const cloudSeries = await getAllSeriesFirestore();
    for (const serie of cloudSeries) {
      try {
        await deleteSerieFirestore(serie.id);
      } catch (err) {
        console.warn(`  ⚠️ Falha ao apagar série ${serie.id}:`, err);
      }
    }
    console.log(`  ✅ ${cloudSeries.length} séries apagadas do Firestore`);

    // Movies
    const cloudMovies = await getAllMoviesFirestore();
    for (const movie of cloudMovies) {
      try {
        await deleteMovieFirestore(movie.id);
      } catch (err) {
        console.warn(`  ⚠️ Falha ao apagar filme ${movie.id}:`, err);
      }
    }
    console.log(`  ✅ ${cloudMovies.length} filmes apagados do Firestore`);

    console.log("✅ Firestore limpo");
  } catch (err) {
    console.error("❌ Erro ao limpar Firestore:", err);
    throw err;
  }
}

export async function clearLocalData() {
  console.log("🗑 Limpando dados locais...");
  console.warn("⚠️ ATENÇÃO: Esta operação apaga TODOS os dados locais!");

  try {
    await storageService.remove(SERIES_KEY);
    await storageService.remove(SERIES_ORDER_KEY);
    await storageService.remove("series_progress");
    await storageService.remove(MOVIES_KEY);
    await storageService.remove(MOVIES_ORDER_KEY);
    await storageService.remove("movies_progress");
    await storageService.remove(NOTIFICATIONS_KEY);
    await storageService.remove("watched_items"); // Legacy - pode ainda existir

    console.log("✅ localStorage limpo");
  } catch (err) {
    console.error("❌ Erro ao limpar localStorage:", err);
    throw err;
  }
}
