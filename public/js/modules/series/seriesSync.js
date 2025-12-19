// js/modules/series/seriesSync.js
// Sincroniza uma série com o TMDB, actualiza Firestore/local cache e ajusta progresso.

import { importFullSeries } from "../tmdbApi.js";
import { getSerieById, updateSerie } from "./seriesDataManager.js";
import { getSerieProgress, updateSerieProgress } from "./seriesProgress.js";
import { storageService } from "../storageService.js";

/**
 * Normalizar temporadas + episódios
 */
function normalizeRemoteSeries(remote) {
  if (!remote) return null;

  const seasons = (remote.seasons || []).map(s => ({
    number: s.number,
    episodes: (s.episodes || []).map(ep => {
      if (typeof ep === "string") return { title: ep };
      if (ep && ep.title) return { 
        title: ep.title,
        air_date: ep.air_date || null
      };
      return { 
        title: ep.name || `Ep. ${ep.episode_number || "?"}`,
        air_date: ep.air_date || null
      };
    })
  }));

  return {
    id: remote.id ? String(remote.id) : undefined,
    title: remote.title || remote.name || "",
    year: remote.year || (remote.first_air_date ? remote.first_air_date.split("-")[0] : ""),
    poster: remote.poster_path
      ? `https://image.tmdb.org/t/p/w500${remote.poster_path}`
      : (remote.poster || "./assets/default.jpg"),
    description: remote.description || remote.overview || "",
    status: remote.status || "",
    genres: remote.genres || [],
    rating: remote.rating || 0,
    seasons
  };
}

/**
 * 🔄 Sincronizar série com TMDB
 * Em guest mode, sincroniza mas guarda apenas localmente (sessionStorage)
 */
export async function syncSerieFromTMDB(serieId) {
  try {
    const local = await getSerieById(serieId);
    if (!local) return { updated: false, addedEpisodes: 0 };

    const tmdbId = local.tmdbId || local.id;
    if (!tmdbId) return { updated: false, addedEpisodes: 0 };

    const remoteFull = await importFullSeries(tmdbId);
    if (!remoteFull) return { updated: false, addedEpisodes: 0 };

    const remote = normalizeRemoteSeries(remoteFull);
    if (!remote || !remote.id) return { updated: false, addedEpisodes: 0 };

    const localSeasons = local.seasons || [];
    const remoteSeasons = remote.seasons || [];

    // Obter progresso para verificar quais episódios já existiam antes
    const progress = await getSerieProgress(serieId);
    const watched = progress?.watched || {};

    // Calcular quantos episódios tinham progresso salvo por temporada
    // Isso indica que esses episódios já existiam antes
    const episodesWithProgress = {};
    Object.keys(watched).forEach(key => {
      // Formato da chave: "S{season}E{episode}" ou similar
      const match = key.match(/S(\d+)E(\d+)/i);
      if (match) {
        const season = parseInt(match[1]);
        const episode = parseInt(match[2]);
        if (!episodesWithProgress[season]) {
          episodesWithProgress[season] = 0;
        }
        // Guardar o maior índice de episódio com progresso nesta temporada
        episodesWithProgress[season] = Math.max(episodesWithProgress[season], episode);
      }
    });

    const localCount = {};
    localSeasons.forEach(s => {
      localCount[s.number] = (s.episodes || []).length;
    });

    let newEpisodes = [];
    let addedCount = 0;

    for (const rs of remoteSeasons) {
      const seasonNum = rs.number;
      const ln = localCount[seasonNum] || 0;
      const rn = (rs.episodes || []).length;
      
      // Verificar quantos episódios desta temporada tinham progresso salvo
      const maxEpWithProgress = episodesWithProgress[seasonNum] || 0;
      
      // Se há progresso salvo, significa que pelo menos esses episódios já existiam
      // O número "real" de episódios locais é o máximo entre:
      // - O número atual de episódios locais
      // - O maior índice de episódio com progresso salvo
      const realLocalCount = Math.max(ln, maxEpWithProgress);

      // Só considerar novos se houver mais episódios remotos que o "real local count"
      if (rn > realLocalCount) {
        const extra = rs.episodes.slice(realLocalCount).map((ep, idx) => ({
          season: seasonNum,
          index: realLocalCount + idx + 1,
          title: ep.title || `Ep. ${realLocalCount + idx + 1}`,
          air_date: ep.air_date || null
        }));

        newEpisodes.push(...extra);
        addedCount += rn - realLocalCount;
      }
    }

    // Sempre atualizar os campos mesmo sem novos episódios
    // IMPORTANTE: Não atualizar o título durante sync para preservar o nome original
    // O título só deve ser atualizado quando a série é adicionada pela primeira vez
    const updatedSerie = {
      ...local,
      // title: NÃO atualizar - preservar o título original que já existe
      poster: remote.poster || local.poster,
      description: remote.description || local.description,
      year: remote.year || local.year,
      status: remote.status || local.status,
      genres: remote.genres || local.genres || [],
      rating: remote.rating || local.rating || 0,
      seasons: remoteSeasons
    };

    await updateSerie(updatedSerie);

    // IMPORTANTE: Não atualizar progresso durante sync do TMDB
    // Isso pode sobrescrever mudanças recentes do usuário
    // Apenas adicionar novos episódios à estrutura, mas não salvar progresso
    // O progresso deve ser gerenciado apenas pelo usuário através de toggleEpisodeProgress
    
    // Não fazer nada com o progresso durante sync
    // Se houver novos episódios, eles aparecerão na UI mas não afetarão o progresso existente

    // Atualizar progresso apenas se houver novos episódios (mas sem modificar o watched existente)
    if (addedCount > 0) {
      const watchedList = await storageService.get("watched_items", {});
      watchedList[serieId] = false;
      await storageService.set("watched_items", watchedList);
      // A partir daqui, notificações de estreia de episódio passam a ser
      // responsabilidade de checkSeriesReleases() na Home, para evitar duplicados.
    }

    // Sempre disparar evento, mesmo sem novos episódios (para atualizar UI)
    document.dispatchEvent(new CustomEvent("serieAutoSynced", {
      detail: {
        id: serieId,
        title: updatedSerie.title || local.title || serieId,
        addedEpisodes: addedCount,
        episodes: newEpisodes
      }
    }));

    return { updated: true, addedEpisodes: addedCount };

  } catch (err) {
    console.error("seriesSync.syncSerieFromTMDB ERROR:", err);
    return { updated: false, addedEpisodes: 0 };
  }
}

