// js/pages/search/searchPage.js
import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { searchMovies, searchSeries } from "../../modules/tmdbApi.js";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

const ITEMS_PER_PAGE = 6; // Mostrar 6 itens por linha
const STORAGE_KEY_PREFIX = "searchPageState_";

let currentQuery = "";
let moviesPage = 1;
let seriesPage = 1;
let moviesTotalPages = 0;
let seriesTotalPages = 0;
let allMovies = []; // Guardar todos os filmes carregados
let allSeries = []; // Guardar todas as séries carregadas

function getQueryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

function getStorageKey(query) {
  return `${STORAGE_KEY_PREFIX}${query}`;
}

function saveState() {
  if (!currentQuery) return;
  
  const state = {
    query: currentQuery,
    moviesPage,
    seriesPage,
    moviesTotalPages,
    seriesTotalPages,
    allMovies,
    allSeries,
  };
  
  try {
    sessionStorage.setItem(getStorageKey(currentQuery), JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to save search page state:", err);
  }
}

function restoreState(query) {
  if (!query) return false;
  
  try {
    const saved = sessionStorage.getItem(getStorageKey(query));
    if (!saved) return false;
    
    const state = JSON.parse(saved);
    
    // Só restaurar se a query corresponder
    if (state.query === query) {
      currentQuery = state.query;
      moviesPage = state.moviesPage || 1;
      seriesPage = state.seriesPage || 1;
      moviesTotalPages = state.moviesTotalPages || 0;
      seriesTotalPages = state.seriesTotalPages || 0;
      allMovies = state.allMovies || [];
      allSeries = state.allSeries || [];
      return true;
    }
  } catch (err) {
    console.warn("Failed to restore search page state:", err);
  }
  
  return false;
}

function clearState(query) {
  if (!query) return;
  try {
    sessionStorage.removeItem(getStorageKey(query));
  } catch (err) {
    console.warn("Failed to clear search page state:", err);
  }
}

function renderMovieCard(movie) {
  return `
    <div class="flex-shrink-0 w-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group cursor-pointer">
      <a href="allmovie.html?id=${movie.id}" class="block">
        <img src="${movie.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold hover:text-blue-400 line-clamp-2 text-sm">${movie.title}</h3>
          <p class="text-xs text-gray-400">${movie.year}</p>
        </div>
      </a>
    </div>
  `;
}

function renderSeriesCard(show) {
  return `
    <div class="flex-shrink-0 w-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 group cursor-pointer">
      <a href="allserie.html?id=${show.id}" class="block">
        <img src="${show.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold hover:text-green-400 line-clamp-2 text-sm">${show.title}</h3>
          <p class="text-xs text-gray-400">${show.year}</p>
        </div>
      </a>
    </div>
  `;
}

function renderPagination(container, currentPage, totalPages, onPageChange, type) {
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const isMovies = type === "movies";
  const btnClass = isMovies 
    ? "px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold transition"
    : "px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xl font-bold transition";
  
  let html = "";

  if (currentPage > 1) {
    html += `<button onclick="window.load${isMovies ? "Movies" : "Series"}Page(${currentPage - 1})" 
              class="${btnClass}">
              ‹
            </button>`;
  }

  html += `<span class="px-3 py-1 text-sm text-gray-300">${currentPage} / ${totalPages}</span>`;

  if (currentPage < totalPages) {
    html += `<button onclick="window.load${isMovies ? "Movies" : "Series"}Page(${currentPage + 1})" 
              class="${btnClass}">
              ›
            </button>`;
  }

  container.innerHTML = html;
}

async function loadMoviesPage(page) {
  if (page < 1 || (moviesTotalPages > 0 && page > moviesTotalPages)) return;

  const moviesGrid = document.getElementById("moviesGrid");
  moviesGrid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  // Se já temos os dados desta página, usar cache
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageMovies = allMovies.slice(startIdx, endIdx);

  if (pageMovies.length > 0) {
    moviesPage = page;
    moviesGrid.innerHTML = pageMovies.map(movie => renderMovieCard(movie)).join("");
    renderPagination(document.getElementById("moviesPagination"), moviesPage, moviesTotalPages, loadMoviesPage, "movies");
    attachImageHandlers(moviesGrid);
    saveState();
    return;
  }

  // Se não temos dados suficientes, carregar mais do TMDB
  try {
    const moviesData = await searchMovies(currentQuery, page);
    const newMovies = (moviesData.results || []).filter(m => 
      m.poster && !m.poster.includes("default.jpg") && !m.poster.includes("No Image")
    );

    if (newMovies.length > 0) {
      // Adicionar novos filmes ao array (evitar duplicados)
      newMovies.forEach(m => {
        if (!allMovies.find(existing => existing.id === m.id)) {
          allMovies.push(m);
        }
      });

      moviesTotalPages = Math.max(moviesTotalPages, moviesData.totalPages || 0);
      moviesPage = page;

      const displayMovies = allMovies.slice(startIdx, endIdx);
      moviesGrid.innerHTML = displayMovies.map(movie => renderMovieCard(movie)).join("");
      renderPagination(document.getElementById("moviesPagination"), moviesPage, moviesTotalPages, loadMoviesPage, "movies");
      attachImageHandlers(moviesGrid);
      saveState();
    } else {
      moviesGrid.innerHTML = `<p class="text-gray-400">No more movies found.</p>`;
    }
  } catch (err) {
    console.error("Error loading movies page:", err);
    moviesGrid.innerHTML = `<p class="text-gray-400">Error loading movies.</p>`;
  }
}

async function loadSeriesPage(page) {
  if (page < 1 || (seriesTotalPages > 0 && page > seriesTotalPages)) return;

  const seriesGrid = document.getElementById("seriesGrid");
  seriesGrid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  // Se já temos os dados desta página, usar cache
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageSeries = allSeries.slice(startIdx, endIdx);

  if (pageSeries.length > 0) {
    seriesPage = page;
    seriesGrid.innerHTML = pageSeries.map(show => renderSeriesCard(show)).join("");
    renderPagination(document.getElementById("seriesPagination"), seriesPage, seriesTotalPages, loadSeriesPage, "series");
    attachImageHandlers(seriesGrid);
    saveState();
    return;
  }

  // Se não temos dados suficientes, carregar mais do TMDB
  try {
    const seriesData = await searchSeries(currentQuery, page);
    const newSeries = (seriesData.results || []).filter(s => 
      s.poster && !s.poster.includes("default.jpg") && !s.poster.includes("No Image")
    );

    if (newSeries.length > 0) {
      // Adicionar novas séries ao array (evitar duplicados)
      newSeries.forEach(s => {
        if (!allSeries.find(existing => existing.id === s.id)) {
          allSeries.push(s);
        }
      });

      seriesTotalPages = Math.max(seriesTotalPages, seriesData.totalPages || 0);
      seriesPage = page;

      const displaySeries = allSeries.slice(startIdx, endIdx);
      seriesGrid.innerHTML = displaySeries.map(show => renderSeriesCard(show)).join("");
      renderPagination(document.getElementById("seriesPagination"), seriesPage, seriesTotalPages, loadSeriesPage, "series");
      attachImageHandlers(seriesGrid);
      saveState();
    } else {
      seriesGrid.innerHTML = `<p class="text-gray-400">No more series found.</p>`;
    }
  } catch (err) {
    console.error("Error loading series page:", err);
    seriesGrid.innerHTML = `<p class="text-gray-400">Error loading series.</p>`;
  }
}

function attachImageHandlers(container) {
  container.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });
}

async function performSearch(query, isNewSearch = false) {
  if (!query || query.trim() === "") {
    document.getElementById("moviesGrid").innerHTML = `<p class="text-gray-400">No search query provided.</p>`;
    document.getElementById("seriesGrid").innerHTML = `<p class="text-gray-400">No search query provided.</p>`;
    return;
  }

  // Se for uma nova pesquisa (query diferente), limpar estado anterior
  if (isNewSearch && currentQuery && currentQuery !== query) {
    clearState(currentQuery);
  }

  // Tentar restaurar estado guardado
  const restored = restoreState(query);
  
  if (restored) {
    // Estado restaurado - renderizar as páginas guardadas
    await loadMoviesPage(moviesPage);
    await loadSeriesPage(seriesPage);
    return;
  }

  // Se não houver estado guardado, fazer nova pesquisa
  currentQuery = query;
  moviesPage = 1;
  seriesPage = 1;
  allMovies = [];
  allSeries = [];
  moviesTotalPages = 0;
  seriesTotalPages = 0;

  // Pesquisar primeira página de filmes e séries em paralelo
  const [moviesData, seriesData] = await Promise.all([
    searchMovies(query, 1),
    searchSeries(query, 1)
  ]);

  // Filtrar filmes e séries sem poster
  allMovies = (moviesData.results || []).filter(m => 
    m.poster && !m.poster.includes("default.jpg") && !m.poster.includes("No Image")
  );
  allSeries = (seriesData.results || []).filter(s => 
    s.poster && !s.poster.includes("default.jpg") && !s.poster.includes("No Image")
  );

  moviesTotalPages = moviesData.totalPages || 0;
  seriesTotalPages = seriesData.totalPages || 0;

  // Renderizar primeira página de cada
  await loadMoviesPage(1);
  await loadSeriesPage(1);
  saveState();
}

// Expor funções globalmente para os botões de paginação
window.loadMoviesPage = loadMoviesPage;
window.loadSeriesPage = loadSeriesPage;

export async function initSearchPage() {
  renderNavbar();
  renderFooter();

  const query = getQueryFromURL();
  const queryDisplay = document.getElementById("searchQuery");
  if (queryDisplay) {
    queryDisplay.textContent = query || "No query";
  }

  if (query) {
    // Verificar se a query mudou (nova pesquisa) ou se é a mesma (voltar atrás)
    const isNewSearch = currentQuery !== query;
    await performSearch(query, isNewSearch);
  } else {
    document.getElementById("moviesGrid").innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
    document.getElementById("seriesGrid").innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
  }
}
