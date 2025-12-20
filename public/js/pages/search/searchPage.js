// js/pages/search/searchPage.js
import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { searchMovies, searchSeries } from "../../modules/tmdbApi.js";
import { t as translate } from "../../modules/idioma.js";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

const ITEMS_PER_PAGE = 6; // Mostrar 6 itens por linha
const STORAGE_KEY_PREFIX = "searchPageState_";

let searchTimeout = null; // Para app mode
let currentQuery = "";
let moviesPage = 1;
let seriesPage = 1;
let moviesTotalPages = 0;
let seriesTotalPages = 0;
let allMovies = []; // Guardar todos os filmes carregados
let allSeries = []; // Guardar todas as séries carregadas

// Detectar app mode
function isAppMode() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         window.innerWidth <= 768;
}

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
    <div class="flex-shrink-0 w-72 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group cursor-pointer">
      <a href="allmovie.html?id=${movie.id}" class="block">
        <img src="${movie.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-[28rem] object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
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
    <div class="flex-shrink-0 w-72 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 group cursor-pointer">
      <a href="allserie.html?id=${show.id}" class="block">
        <img src="${show.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-[28rem] object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
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
  if (!moviesGrid) return;
  
  moviesGrid.innerHTML = `<p class="text-gray-400">${translate('loading')}</p>`;

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
      moviesGrid.innerHTML = `<p class="text-gray-400">${translate('noMoreMoviesFound')}</p>`;
    }
  } catch (err) {
    console.error("Error loading movies page:", err);
    moviesGrid.innerHTML = `<p class="text-gray-400">${translate('errorLoadingMovies')}</p>`;
  }
}

async function loadSeriesPage(page) {
  if (page < 1 || (seriesTotalPages > 0 && page > seriesTotalPages)) return;

  const seriesGrid = document.getElementById("seriesGrid");
  if (!seriesGrid) return;
  
  seriesGrid.innerHTML = `<p class="text-gray-400">${translate('loading')}</p>`;

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
      seriesGrid.innerHTML = `<p class="text-gray-400">${translate('noMoreSeriesFound')}</p>`;
    }
  } catch (err) {
    console.error("Error loading series page:", err);
    seriesGrid.innerHTML = `<p class="text-gray-400">${translate('errorLoadingSeries')}</p>`;
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

// App Mode: pesquisa em tempo real (sem paginação)
async function performSearchApp(query) {
  const moviesGrid = document.getElementById("moviesGridApp");
  const seriesGrid = document.getElementById("seriesGridApp");
  
  if (!moviesGrid || !seriesGrid) return;

  if (!query || query.trim() === "") {
    moviesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('startTypingToSearch')}</p>`;
    seriesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('startTypingToSearch')}</p>`;
    allMovies = [];
    allSeries = [];
    return;
  }

  // Mostrar loading
  moviesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('searchingMovies')}</p>`;
  seriesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('searchingSeries')}</p>`;

  try {
    // Pesquisar filmes e séries em paralelo
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

    // Renderizar todos os resultados em scroll horizontal (sem paginação)
    if (allMovies.length > 0) {
      moviesGrid.innerHTML = allMovies.map(movie => renderMovieCard(movie)).join("");
      attachImageHandlers(moviesGrid);
    } else {
      moviesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('noMoviesFound')}</p>`;
    }

    if (allSeries.length > 0) {
      seriesGrid.innerHTML = allSeries.map(show => renderSeriesCard(show)).join("");
      attachImageHandlers(seriesGrid);
    } else {
      seriesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('noSeriesFound')}</p>`;
    }
  } catch (err) {
    console.error("Error performing search:", err);
    moviesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('errorSearchingMovies')}</p>`;
    seriesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('errorSearchingSeries')}</p>`;
  }
}

// Desktop: pesquisa com paginação (código original)
async function performSearch(query, isNewSearch = false) {
  if (!query || query.trim() === "") {
    const moviesGrid = document.getElementById("moviesGrid");
    const seriesGrid = document.getElementById("seriesGrid");
    if (moviesGrid) moviesGrid.innerHTML = `<p class="text-gray-400">${translate('noSearchQueryProvided')}</p>`;
    if (seriesGrid) seriesGrid.innerHTML = `<p class="text-gray-400">${translate('noSearchQueryProvided')}</p>`;
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

// Expor funções globalmente para os botões de paginação (desktop)
window.loadMoviesPage = loadMoviesPage;
window.loadSeriesPage = loadSeriesPage;

export async function initSearchPage() {
  renderNavbar();
  renderFooter();

  const appMode = isAppMode();

  // Mostrar/esconder layouts baseado no app mode
  const appLayout = document.getElementById("appLayout");
  const desktopLayout = document.getElementById("desktopLayout");
  
  if (appMode) {
    // Mostrar app layout e esconder desktop layout
    if (appLayout) {
      appLayout.style.display = 'flex';
    }
    if (desktopLayout) {
      desktopLayout.style.display = 'none';
    }
    
    // App Mode: pesquisa em tempo real
    const searchInput = document.getElementById("searchInput");
    
    if (!searchInput) {
      return;
    }

    // Focar automaticamente no input quando a página carrega
    setTimeout(() => {
      searchInput.focus();
    }, 100);

    const query = getQueryFromURL();
    if (query) {
      searchInput.value = query;
      await performSearchApp(query);
    }

    // Pesquisa em tempo real enquanto escreve (com debounce)
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (!query) {
        const moviesGrid = document.getElementById("moviesGridApp");
        const seriesGrid = document.getElementById("seriesGridApp");
        if (moviesGrid) moviesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('startTypingToSearch')}</p>`;
        if (seriesGrid) seriesGrid.innerHTML = `<p class="text-gray-400 self-center">${translate('startTypingToSearch')}</p>`;
        window.history.replaceState({}, '', 'search.html');
        return;
      }

      // Debounce: esperar 500ms após parar de escrever
      searchTimeout = setTimeout(async () => {
        window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
        await performSearchApp(query);
      }, 500);
    });

    // Permitir pesquisa imediata ao pressionar Enter
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (searchTimeout) clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query) {
          window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
          performSearchApp(query);
        }
      }
    });
  } else {
    // Mostrar desktop layout e esconder app layout
    if (appLayout) {
      appLayout.style.display = 'none';
    }
    if (desktopLayout) {
      desktopLayout.style.display = 'block';
    }
    
    // Desktop: focar na search bar da navbar quando a página carrega
    const navbarSearchInput = document.getElementById("search");
    if (navbarSearchInput) {
      setTimeout(() => {
        navbarSearchInput.focus();
        console.log("[Search Page] Focused navbar search input (desktop mode)");
      }, 100);

      // Preencher o input com a query da URL se existir
      const queryFromURL = getQueryFromURL();
      if (queryFromURL) {
        navbarSearchInput.value = queryFromURL;
      }

      // Listener para pesquisa em tempo real enquanto escreve (com debounce)
      let desktopSearchTimeout = null;
      navbarSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        console.log("[Search Page] Desktop input event - query:", query);
        
        if (desktopSearchTimeout) {
          clearTimeout(desktopSearchTimeout);
        }

        if (!query) {
          // Se a query estiver vazia, limpar resultados
          const queryDisplay = document.getElementById("searchQuery");
          if (queryDisplay) {
            queryDisplay.textContent = "No query";
          }
          const moviesGrid = document.getElementById("moviesGrid");
          const seriesGrid = document.getElementById("seriesGrid");
          if (moviesGrid) moviesGrid.innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
          if (seriesGrid) seriesGrid.innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
          window.history.replaceState({}, '', 'search.html');
          return;
        }

        // Debounce: esperar 500ms após parar de escrever
        desktopSearchTimeout = setTimeout(async () => {
          console.log("[Search Page] Desktop performing search for:", query);
          window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
          const queryDisplay = document.getElementById("searchQuery");
          if (queryDisplay) {
            queryDisplay.textContent = query;
          }
          const isNewSearch = currentQuery !== query;
          await performSearch(query, isNewSearch);
        }, 500);
      });

      // Permitir pesquisa imediata ao pressionar Enter
      navbarSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (desktopSearchTimeout) clearTimeout(desktopSearchTimeout);
          const query = e.target.value.trim();
          if (query) {
            console.log("[Search Page] Desktop Enter pressed - performing search for:", query);
            window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
            const queryDisplay = document.getElementById("searchQuery");
            if (queryDisplay) {
              queryDisplay.textContent = query;
            }
            const isNewSearch = currentQuery !== query;
            performSearch(query, isNewSearch);
          }
        }
      });
    }
    
    // Desktop: código original exatamente como estava
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
      const moviesGrid = document.getElementById("moviesGrid");
      const seriesGrid = document.getElementById("seriesGrid");
      if (moviesGrid) moviesGrid.innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
      if (seriesGrid) seriesGrid.innerHTML = `<p class="text-gray-400">Please provide a search query.</p>`;
    }
  }
}
