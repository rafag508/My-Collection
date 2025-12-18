// js/pages/seriePage.js
import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";

import { getSerieById, getAllSeries } from "../../modules/series/seriesDataManager.js";
import {
  getSerieProgress,
  toggleEpisodeProgress,
  markSerieAsViewed,
  unmarkSerieAsViewed
} from "../../modules/series/seriesProgress.js";

import { syncSerieFromTMDB } from "../../modules/series/seriesSync.js";
import { storageService } from "../../modules/storageService.js";
import { toastSuccess } from "../../ui/toast.js";
import { addSerieToFavorites, removeSerieFromFavorites, isSerieFavorite } from "../../modules/series/seriesFavorites.js";
import { addSerieToFollowing, removeSerieFromFollowing, isSerieFollowing } from "../../modules/series/followingSeries.js";
import { t as translate } from "../../modules/idioma.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let serieId = null;
let serie = null;
let progress = null;
let fromAllSeries = false;
let isFavorite = false;
let isFollowingSerie = false;

// 🔥 Lista de temporadas abertas (carregada do localStorage)
let openSeasons = new Set();

/* ============================================================
   INIT PAGE
============================================================ */
export async function initSeriePage() {
  renderNavbar();
  renderFooter();

  // Mostrar botão de voltar em app mode
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    (window.innerWidth <= 768);
  const backButton = document.getElementById('backButton');
  if (backButton && isAppMode) {
    backButton.classList.remove('hidden');
  }

  const params = new URLSearchParams(window.location.search);
  serieId = params.get("id");
  fromAllSeries = params.get("from") === "allseries";

  if (!serieId) {
    document.body.innerHTML = `<p class="text-center mt-10">${translate("invalidSeries")}</p>`;
    return;
  }

  // 1 — Primeiro tentar buscar pelo ID interno
  serie = await getSerieById(serieId);
  
  // Se não encontrar, tentar buscar pelo TMDB ID usando apenas cache
  if (!serie) {
    const allSeries = await getAllSeries({ syncFromCloud: false });
    serie = allSeries.find(s => (s.tmdbId || s.id)?.toString() === serieId.toString());
  }
  
  // Se ainda não encontrar, pode ser um TMDB ID de uma série que não está na coleção
  // Tentar buscar detalhes do TMDB e adicionar automaticamente
  if (!serie) {
    try {
      const { getSeriesDetails } = await import("../../modules/tmdbApi.js");
      const { addSerie } = await import("../../modules/series/seriesDataManager.js");
      
      // Usar getSeriesDetails (mais rápido, não precisa carregar todas as temporadas/episódios)
      // Se vier de allseries, não vamos mostrar temporadas/episódios mesmo
      const tmdbData = await getSeriesDetails(serieId);
      
      if (tmdbData) {
        // Adicionar a série à coleção (formato igual ao addSeriesPage.js)
        const newSerie = {
          id: `s${Date.now()}`,
          tmdbId: serieId.toString(), // Guardar explicitamente o ID do TMDB
          title: tmdbData.title,
          year: tmdbData.year,
          poster: tmdbData.poster,
          description: tmdbData.description || "",
          status: tmdbData.status || "On Display",
          genres: tmdbData.genres || [],
          rating: tmdbData.rating || 0,
          seasons: tmdbData.seasons || [], // Se vem de allseries, já terá temporadas e episódios completos
        };
        
        await addSerie(newSerie);
        serie = newSerie;
        serieId = newSerie.id; // Atualizar para usar o ID interno
      } else {
        document.body.innerHTML = `<p class="text-center mt-10">${translate("seriesNotFound")}</p>`;
        return;
      }
    } catch (err) {
      console.error("Erro ao buscar série do TMDB:", err);
      document.body.innerHTML = `<p class="text-center mt-10">${translate("seriesNotFound")}</p>`;
      return;
    }
  }

  // 🔥 Carregar temporadas abertas guardadas (depois de ter o serieId final)
  loadOpenSeasons();

  // 2 — progresso
  progress = await getSerieProgress(serieId);

  // 2.5 — verificar se é favorita
  try {
    const favKey = serie.tmdbId || serieId;
    isFavorite = await isSerieFavorite(favKey);
  } catch (err) {
    console.warn("Erro ao verificar favorito da série:", err);
    isFavorite = false;
  }

  // 2.6 — verificar se está em following_series
  try {
    const followKey = serie.tmdbId || serieId;
    isFollowingSerie = await isSerieFollowing(followKey);
  } catch (err) {
    console.warn("Erro ao verificar following da série:", err);
    isFollowingSerie = false;
  }

  // 3 — Renderizar primeiro (não bloqueia)
  renderSerieInfo();
  // Se não vier de allseries, renderizar temporadas e episódios
  if (!fromAllSeries) {
    renderSeasons();
  } else {
    // Se vier de allseries, mostrar mensagem ou esconder a seção
    const seasonsContainer = document.getElementById("seasons");
    if (seasonsContainer) {
      seasonsContainer.innerHTML = "";
    }
  }
  // Atualizar progress bar após render (usar setTimeout para garantir que DOM está atualizado)
  setTimeout(() => {
    updateProgressInfo();
  }, 0);

  // 4 — Sincronizar com TMDB em background (não bloquear a UI)
  syncSerieFromTMDB(serieId).then(async () => {
      const updatedSerie = await getSerieById(serieId);
      if (updatedSerie) {
        serie = updatedSerie;
        renderSerieInfo(); // Atualizar UI silenciosamente se houver mudanças
        // Se não vier de allseries, re-renderizar temporadas
        if (!fromAllSeries) {
          renderSeasons(); // Re-renderizar temporadas caso necessário
        }
      }
  }).catch(err => {
    console.warn("TMDB sync failed:", err);
    // Falha silenciosa - UI já está renderizada com dados locais
  });
}

/* ============================================================
   LOCAL STORAGE — Temporadas abertas
============================================================ */
function loadOpenSeasons() {
  const key = `open_seasons_${serieId}`;
  const stored = JSON.parse(localStorage.getItem(key) || "[]");
  openSeasons = new Set(stored.map(n => Number(n)));
}

function saveOpenSeasons() {
  const key = `open_seasons_${serieId}`;
  localStorage.setItem(key, JSON.stringify([...openSeasons]));
}

/* ============================================================
   HEADER DA SÉRIE
============================================================ */
async function renderSerieInfo() {
  const container = document.getElementById("serieInfo");
  if (!container) return;

  const fullyWatched = isFullyWatched();
  
  // Calcular progresso para exibir imediatamente
  // Se vier de allseries, não mostrar informações de progresso
  let progressText = "";
  if (!fromAllSeries) {
    // Garantir que seasons existe e é um array
    const seasons = Array.isArray(serie.seasons) ? serie.seasons : [];
    const total = seasons.reduce((a, s) => a + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0);
    const watched = Object.values(progress?.watched || {}).filter(Boolean).length;
    const percent = total > 0 ? Math.round((watched / total) * 100) : 0;
    progressText = total > 0 ? `Progress: ${watched}/${total} episodes (${percent}%)` : "No episodes available";
  }

  // Detectar app mode
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    (window.innerWidth <= 768);

  if (isAppMode) {
    // Layout para app mode
    container.innerHTML = `
      <!-- Header fixo: Back + Título + Favorito -->
      <div class="app-mode-header fixed top-0 left-0 right-0 h-20 bg-gray-900/95 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-4">
        <a href="javascript:history.back()" class="w-14 h-14 flex items-center justify-center text-white text-4xl">←</a>
        <h1 class="text-xl font-bold text-center flex-1 px-4 truncate">${serie.title}</h1>
        <button
          id="favoriteToggleBtn"
          class="w-14 h-14 rounded-full border-2 border-yellow-400 flex items-center justify-center text-yellow-400 flex-shrink-0"
          title="${isFavorite ? "Remove from favorites" : "Add to favorites"}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-7 h-7">
            ${
              isFavorite
                ? `
            <path d="M6 3.5C6 2.67 6.67 2 7.5 2h9a1.5 1.5 0 0 1 1.5 1.5v17.1c0 .8-.88 1.28-1.55.83L12 17.5l-4.45 3.93c-.67.45-1.55-.03-1.55-.83V3.5Z"
                  fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                `
                : `
            <path d="M7.5 3h9A1.5 1.5 0 0 1 18 4.5v17.1c0 .8-.88 1.28-1.55.83L12 18.5l-4.45 3.93c-.67.45-1.55-.03-1.55-.83V4.5A1.5 1.5 0 0 1 7.5 3Z"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                `
            }
          </svg>
        </button>
      </div>

      <!-- Conteúdo principal (com padding-top para compensar header) -->
      <div class="app-mode-content pt-24 pb-8">
        <!-- Poster horizontal -->
        <div class="mb-6">
          <img src="${serie.poster}"
               data-placeholder="${PLACEHOLDER_IMAGE}"
               class="w-full object-cover rounded-lg shadow-lg" />
        </div>

        <!-- Sinopse -->
        <p class="text-gray-400 mb-6 text-xl leading-relaxed">
          ${serie.description || "No description available."}
        </p>

        <!-- Info: Year, Status, Genre -->
        <div class="mb-6 text-xl text-gray-400 space-y-2">
          <div><span class="font-semibold text-white">Year:</span> ${serie.year}</div>
          <div>
            <span class="font-semibold text-white">TV Status:</span>
            <span class="${serie.status === "On Display" ? "text-green-400" : "text-red-500"}"> ${serie.status}</span>
          </div>
          ${serie.genres && serie.genres.length > 0
            ? `<div><span class="font-semibold text-white">Genre:</span> ${serie.genres.join(", ")}</div>`
            : ""}
        </div>

        <!-- Botão marcar como visto + Rating -->
        <div class="mb-6 flex items-center gap-4">
          ${!fromAllSeries ? `
          <button id="toggleAllBtn"
            class="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-semibold text-xl">
            ${fullyWatched ? `❌ ${translate("unmark")}` : `✔️ ${translate("markAsViewed")}`}
          </button>
          ` : ""}
          ${serie.rating
            ? `<span class="w-16 h-16 rounded-full bg-transparent border-2 border-green-900 flex items-center justify-center text-green-400 font-bold text-xl">
                ${serie.rating.toFixed(1)}
              </span>`
            : ""}
        </div>

        <!-- Progress text (só para séries da coleção) -->
        ${!fromAllSeries ? `
        <div id="progressInfo" class="mb-3 text-xl text-gray-400">
          ${progressText}
        </div>
        ` : ""}

        <!-- Progress bar (só para séries da coleção) -->
        ${!fromAllSeries ? `
        <div id="progressBar" class="mb-6">
          <div class="w-full bg-gray-800 rounded-full h-3">
            <div id="progressFill"
                 class="h-3 bg-green-500 rounded-full transition-all duration-300"
                 style="width: 0%">
            </div>
          </div>
        </div>
        ` : ""}
      </div>
    `;
  } else {
    // Layout original para desktop
    container.innerHTML = `
      <div class="flex flex-col md:flex-row gap-8">

        <img src="${serie.poster}"
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-48 h-72 object-cover rounded-lg shadow-lg ring-1 ring-white/10" />

        <div class="mt-4 md:mt-0">
          <h1 class="text-3xl font-bold mb-2 flex items-center gap-3">
            ${serie.title}
            <button
              id="favoriteToggleBtn"
              class="w-9 h-9 rounded-full border-2 border-yellow-400 flex items-center justify-center text-yellow-400"
              title="${isFavorite ? "Remove from favorites" : "Add to favorites"}"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6 h-6">
                ${
                  isFavorite
                    ? `
              <path d="M6 3.5C6 2.67 6.67 2 7.5 2h9a1.5 1.5 0 0 1 1.5 1.5v17.1c0 .8-.88 1.28-1.55.83L12 17.5l-4.45 3.93c-.67.45-1.55-.03-1.55-.83V3.5Z"
                    fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  `
                  : `
              <path d="M7.5 3h9A1.5 1.5 0 0 1 18 4.5v17.1c0 .8-.88 1.28-1.55.83L12 18.5l-4.45 3.93c-.67.45-1.55-.03-1.55-.83V4.5A1.5 1.5 0 0 1 7.5 3Z"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  `
                }
              </svg>
            </button>
          </h1>

          <p class="text-gray-400 mb-4 max-w-2xl">
            ${serie.description || "No description available."}
          </p>

          <div class="mt-4 text-sm text-gray-400 flex items-center gap-3">
            <span><span class="font-semibold text-white">• Year:</span> ${serie.year}</span>
            <span>
              <span class="font-semibold text-white">• TV Status:</span>
              <span class="${serie.status === "On Display" ? "text-green-400" : "text-red-500"}"> ${serie.status}</span>
            </span>
            ${serie.genres && serie.genres.length > 0
              ? `<span><span class="font-semibold text-white">• Genre:</span> ${serie.genres.join(", ")}</span>`
              : ""}
          </div>

          <div class="mt-4 flex items-center gap-3 flex-wrap">
            ${!fromAllSeries ? `
            <button id="toggleAllBtn"
              class="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg font-semibold">
              ${fullyWatched ? `❌ ${translate("unmark")}` : `✔️ ${translate("markAsViewed")}`}
            </button>
            ` : ""}

            ${!fromAllSeries && serie.status === "On Display" ? `
            <button id="followToggleBtn"
              class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold">
              ${isFollowingSerie ? "Unfollow" : "Follow"}
            </button>
            ` : ""}

            ${serie.rating
              ? `<span class="w-12 h-12 rounded-full bg-transparent border border-blue-900 flex items-center justify-center text-blue-400 font-bold text-sm">
                  ${serie.rating.toFixed(1)}
                </span>`
              : ""}
          </div>

          ${!fromAllSeries ? `<div id="progressInfo" class="mt-5 text-sm text-gray-400" style="display: block !important;">${progressText}</div>` : ""}
        </div>

      </div>
    `;
  }

  // Adicionar handler de erro para imagem após inserir HTML
  const img = container.querySelector('img[data-placeholder]');
  if (img) {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  }

  const toggleBtn = document.getElementById("toggleAllBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleAllEpisodes);
  }

  const favoriteBtn = document.getElementById("favoriteToggleBtn");
  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", toggleFavorite);
  }

  const followBtn = document.getElementById("followToggleBtn");
  if (followBtn) {
    followBtn.addEventListener("click", toggleFollowSerie);
  }

  // Se estiver em app mode, atualizar progress bar imediatamente após render
  if (isAppMode && !fromAllSeries) {
    // Usar setTimeout para garantir que o DOM está atualizado
    setTimeout(() => {
      updateProgressInfo();
    }, 0);
  }
}

/* ============================================================
   SEASONS + COLLAPSE
============================================================ */
function renderSeasons() {
  const container = document.getElementById("seasons");
  if (!container) return;

  // Garantir que seasons existe e é um array
  const seasons = Array.isArray(serie.seasons) ? serie.seasons : [];
  
  if (seasons.length === 0) {
    container.innerHTML = `<p class="text-gray-400 text-center py-8">No seasons available. The series data will be loaded from TMDB.</p>`;
    return;
  }

  container.innerHTML = seasons
    .map(season => {
      const isOpen = openSeasons.has(season.number);
      return `
        <div class="mb-6 border border-white/10 rounded-lg">
          
          <!-- HEADER da temporada -->
          <button
            class="w-full flex justify-between items-center px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg"
            onclick="toggleSeason(${season.number})"
          >
            <span class="text-lg font-semibold">Season ${season.number}</span>
            <span class="text-2xl">${isOpen ? "↑" : "↓"}</span>
          </button>



          <!-- EPISÓDIOS -->
          <div class="px-3 pb-2 transition-all duration-300"
               style="display: ${isOpen ? "block" : "none"}">

            <div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
              ${season.episodes
                .map((ep, index) => {
                  const key = `${season.number}-${index + 1}`;
                  const isWatched = progress?.watched?.[key] || false;

                  return `
                    <button onclick="toggleEpisode(${season.number}, ${index + 1})"
                      class="episode-btn px-3 py-2 rounded-md text-sm truncate
                      ${isWatched ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"}"
                      title="${ep.title}">
                      ${ep.title}
                    </button>
                  `;
                })
                .join("")}
            </div>

          </div>
        </div>
      `;
    })
    .join("");
}

/* Toggle temporada */
window.toggleSeason = function (seasonNumber) {
  if (openSeasons.has(seasonNumber)) {
    openSeasons.delete(seasonNumber);
  } else {
    openSeasons.add(seasonNumber);
  }

  saveOpenSeasons();
  renderSeasons(); // ← Redesenhar mantendo estado
};

/* ============================================================
   PROGRESS
============================================================ */
function updateProgressInfo() {
  // Se vier de allseries, não atualizar informações de progresso
  if (fromAllSeries) return;
  
  // Garantir que seasons existe e é um array
  const seasons = Array.isArray(serie.seasons) ? serie.seasons : [];
  const total = seasons.reduce((a, s) => a + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0);
  const watched = Object.values(progress?.watched || {}).filter(Boolean).length;
  const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

  // Procurar progressFill em qualquer lugar (pode estar no app-mode-content ou no main)
  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
    // Garantir que está visível
    progressFill.style.display = "block";
    progressFill.style.visibility = "visible";
    progressFill.style.opacity = "1";
  }

  const el = document.getElementById("progressInfo");
  if (el) {
    el.innerText = `Progress: ${watched}/${total} episodes (${percent}%)`;
    el.style.display = "block"; // Garantir que está visível
    el.style.visibility = "visible"; // Garantir visibilidade
    el.style.opacity = "1"; // Garantir opacidade
  }

  const btn = document.getElementById("toggleAllBtn");
  if (btn && !fromAllSeries) {
    btn.textContent =
      watched === total && total > 0
        ? `❌ ${translate("unmark")}`
        : `✔️ ${translate("markAsViewed")}`;
  }
}

async function toggleFavorite() {
  if (!serie) return;

  try {
    const favKey = serie.tmdbId || serieId;

    if (isFavorite) {
      await removeSerieFromFavorites(favKey);
      isFavorite = false;
      toastSuccess(translate("removedFromFavorites") || "Removed from favorites");
    } else {
      await addSerieToFavorites(serie);
      isFavorite = true;
      toastSuccess(translate("addedToFavorites") || "Added to favorites");
    }

    // Re-renderizar header para atualizar ícone
    renderSerieInfo();
  } catch (err) {
    console.error("Erro ao alternar favorito da série:", err);
    alert("Error updating favorites. Please try again.");
  }
}

async function toggleFollowSerie() {
  if (!serie) return;

  try {
    const followKey = serie.tmdbId || serieId;

    if (isFollowingSerie) {
      await removeSerieFromFollowing(followKey);
      isFollowingSerie = false;
      toastSuccess("Removed from following");
    } else {
      await addSerieToFollowing(serie);
      isFollowingSerie = true;
      toastSuccess("Added to following");
    }

    // Re-renderizar header para atualizar texto do botão
    renderSerieInfo();
  } catch (err) {
    console.error("Erro ao alternar following da série:", err);
    alert("Error updating following list. Please try again.");
  }
}

function isFullyWatched() {
  // Garantir que seasons existe e é um array
  const seasons = Array.isArray(serie.seasons) ? serie.seasons : [];
  const total = seasons.reduce((a, s) => a + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0);
  const watched = Object.values(progress?.watched || {}).filter(Boolean).length;
  return total > 0 && watched === total;
}

/* ============================================================
   TOGGLE EPISODE
============================================================ */
async function toggleAllEpisodes() {
  if (isFullyWatched()) {
    progress = await unmarkSerieAsViewed(serieId);
    toastSuccess(`❌ ${translate("unmark")}`);
  } else {
    progress = await markSerieAsViewed(serieId, serie);
    toastSuccess(`✔️ ${translate("markAsViewed")}`);
  }

  renderSerieInfo();
  renderSeasons();
  updateProgressInfo();
}

window.toggleEpisode = async function (season, ep) {
  progress = await toggleEpisodeProgress(serie, serieId, season, ep);

  updateProgressInfo();
  renderSeasons(); // ← temporadas continuam abertas
};

