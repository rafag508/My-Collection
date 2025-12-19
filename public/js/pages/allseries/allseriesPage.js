import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { getPopularSeries, searchSeries, discoverSeries } from "../../modules/tmdbApi.js";
import { PaginationManager } from "../../modules/shared/pagination.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

const PAGE_SIZE = 20;
let currentPage = 1;
let isSearchMode = false;
let isFilterMode = false;
let searchTimeout = null;
let currentSearchQuery = "";
let searchTotalPages = 0;
let pagination = null; // Será inicializado no initAllSeriesPage
let totalPages = 0; // Total de páginas atual (para filter/normal)
let currentFilters = {
  topRating: false,
  genres: [],
  year: null
};

// Função helper para aplicar padding do grid no modo app
function applyAllSeriesGridPadding() {
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  if (isAppMode) {
    const grid = document.getElementById('seriesGrid');
    if (grid) {
      grid.style.paddingLeft = '24px';
      grid.style.paddingRight = '24px';
    }
  }
}

// 🔥 Funções para gerir paginação na URL
function getPageFromURL() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page'), 10);
  return (page && page > 0) ? page : 1;
}

function updateURL(page) {
  const url = new URL(window.location);
  if (page === 1) {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }
  window.history.pushState({ page }, '', url);
}

export async function initAllSeriesPage() {
  renderNavbar();
  renderFooter();

  // 🔥 LER PÁGINA DA URL (ou usar 1 como padrão)
  let urlPage = getPageFromURL();
  
  // Verificar referrer para determinar se veio de páginas externas
  const referrer = document.referrer;
  // Se vier de páginas externas (Home, movies, series, etc.), limpar tudo
  // NOTA: allserie.html NÃO é considerado página externa - é a página de detalhes da série
  const cameFromExternalPage = referrer && (
    referrer.includes('index.html') || 
    referrer.includes('movies.html') || 
    referrer.includes('movie.html') ||
    referrer.includes('series.html') ||
    referrer.includes('serie.html') ||
    referrer.includes('settings.html') ||
    referrer.includes('login.html') ||
    referrer.includes('notifications.html') ||
    referrer.includes('stats.html')
  );
  
  // Verificar se veio de allserie.html (página de detalhes)
  // Também verificar se há filtros salvos (indica que pode ter vindo de um card)
  const cameFromSeriePage = referrer && referrer.includes('allserie.html');
  
  // Verificar se há dados salvos (página e filtros)
  const savedPage = sessionStorage.getItem('allseriesPage');
  const savedFilters = sessionStorage.getItem('allseriesFilters');
  const cameFromCard = sessionStorage.getItem('allseriesFromCard') === 'true';
  
  // Se veio de uma página externa, limpar tudo
  // EXCETO se há filtros salvos E a flag cameFromCard está ativa (significa que veio de um card)
  if (cameFromExternalPage && !(savedFilters && cameFromCard)) {
    sessionStorage.removeItem('allseriesFromCard');
    sessionStorage.removeItem('allseriesPage');
    sessionStorage.removeItem('allseriesFilters');
    currentPage = urlPage === 1 ? 1 : urlPage;
    currentFilters = {
      topRating: false,
      genres: [],
      year: null
    };
    isFilterMode = false;
  } 
  // Se há filtros salvos OU veio de allserie.html OU tem flag de card OU tem página salva, restaurar
  // IMPORTANTE: Sempre restaurar se houver filtros salvos (a menos que venha de página externa)
  else if (savedFilters || cameFromSeriePage || cameFromCard || savedPage) {
    // Se veio de allserie.html mas não há flag, manter os filtros salvos
    if (cameFromSeriePage && !cameFromCard && savedFilters) {
      // Manter os filtros salvos
    }
    // Remover a flag se existir (já foi usada)
    if (cameFromCard) {
      sessionStorage.removeItem('allseriesFromCard');
    }
    
    // Restaurar página do sessionStorage se não houver na URL
    if (urlPage === 1 && savedPage) {
      currentPage = parseInt(savedPage, 10);
      updateURL(currentPage);
    } else {
      currentPage = urlPage;
    }
    
    // Restaurar filtros do sessionStorage se existirem
    if (savedFilters) {
      try {
        currentFilters = JSON.parse(savedFilters);
        isFilterMode = currentFilters.topRating || 
                       (currentFilters.genres && currentFilters.genres.length > 0) ||
                       currentFilters.year;
      } catch (e) {
        console.warn("❌ Erro ao restaurar filtros:", e);
        currentFilters = {
          topRating: false,
          genres: [],
          year: null
        };
        isFilterMode = false;
      }
    } else {
      // Se não há filtros salvos, usar valores padrão
      currentFilters = {
        topRating: false,
        genres: [],
        year: null
      };
      isFilterMode = false;
    }
  } 
  // Caso padrão: começar limpo
  else {
    currentPage = urlPage === 1 ? 1 : urlPage;
    currentFilters = {
      topRating: false,
      genres: [],
      year: null
    };
    isFilterMode = false;
  }

  // ✅ INICIALIZAR PAGINAÇÃO
  pagination = new PaginationManager({
    pageSize: PAGE_SIZE,
    initialPage: currentPage,
    buttonPrefix: 'allseries',
    activeColor: 'bg-green-600',
    updateURL: (page) => {
      updateURL(page);
      currentPage = page;
      // Save current page and filters to sessionStorage
      sessionStorage.setItem('allseriesPage', page.toString());
      if (isFilterMode) {
        sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      }
    },
    getTotalItems: () => {
      if (isSearchMode) {
        return searchTotalPages > 0 ? searchTotalPages * PAGE_SIZE : PAGE_SIZE;
      }
      return totalPages > 0 ? totalPages * PAGE_SIZE : PAGE_SIZE;
    },
    onPageChange: (page) => {
      currentPage = page;
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Verificar o modo e chamar a função apropriada
      if (isSearchMode && currentSearchQuery) {
        performSearch(currentSearchQuery, page);
      } else if (isFilterMode) {
        loadFilteredSeries(page);
      } else {
        loadSeries();
      }
    }
  });

  if (isFilterMode) {
    await loadFilteredSeries(currentPage);
  } else {
    await loadSeries();
  }
  
  // Scroll to top when returning from a card
  window.scrollTo({ top: 0, behavior: "instant" });
  
  setupSearch();
  setupFilter();

  // Mostrar tabs apenas no modo app
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  const tabsElement = document.querySelector('.allseries-tabs');
  if (tabsElement) {
    if (isAppMode) {
      tabsElement.classList.remove('hidden');
    } else {
      tabsElement.classList.add('hidden');
    }
  }

  // Aplicar padding do grid imediatamente
  applyAllSeriesGridPadding();

  // Adicionar swipe para mudar entre páginas (apenas no modo app)
  if (isAppMode) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwipe = false;
    const mainElement = document.querySelector('main');

    if (mainElement && pagination) {
      mainElement.addEventListener('touchstart', (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON' && !target.closest('.series-card')) {
          return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isSwipe = false;
      }, { passive: true });

      mainElement.addEventListener('touchmove', (e) => {
        if (touchStartX === 0) return;
        const currentX = e.changedTouches[0].screenX;
        const currentY = e.changedTouches[0].screenY;
        const diffX = Math.abs(currentX - touchStartX);
        const diffY = Math.abs(currentY - touchStartY);
        
        if (diffX > diffY && diffX > 10) {
          isSwipe = true;
        }
      }, { passive: true });

      mainElement.addEventListener('touchend', (e) => {
        if (!isSwipe || touchStartX === 0) {
          touchStartX = 0;
          touchStartY = 0;
          return;
        }

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        
        const diffX = touchStartX - touchEndX;
        const diffY = Math.abs(touchStartY - touchEndY);
        const swipeThreshold = 80;

        if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > diffY) {
          if (!pagination) {
            return;
          }
          
          const target = e.target;
          if (target.closest('.series-card-link')) {
            e.preventDefault();
            e.stopPropagation();
          }
          
          if (diffX > 0) {
            pagination.nextPage();
          } else {
            pagination.prevPage();
          }
        }

        touchStartX = 0;
        touchStartY = 0;
        touchEndX = 0;
        touchEndY = 0;
        isSwipe = false;
      }, { passive: true });
    }
  }
  
  // ✅ PopState já está configurado no PaginationManager.setupPopStateListener()
  if (pagination) {
    pagination.setupPopStateListener();
  }
}

function setupSearch() {
  const input = document.getElementById("search");
  if (!input) return;

  input.addEventListener("input", e => {
    const query = e.target.value.trim();

    if (searchTimeout) clearTimeout(searchTimeout);

    if (query === "") {
      isSearchMode = false;
      currentSearchQuery = "";
      currentPage = 1;
      // Atualizar URL e estado sem disparar callbacks
      updateURL(1);
      if (pagination) {
        pagination.currentPage = 1;
        pagination.ensureCurrentPageInRange();
      }
      if (isFilterMode) {
        loadFilteredSeries(1);
      } else {
        loadSeries();
      }
      return;
    }

    currentSearchQuery = query;
    currentPage = 1;
    isFilterMode = false; // Desativar filtros quando pesquisar
    // Atualizar URL e estado sem disparar callbacks (performSearch será chamado pelo setTimeout)
    updateURL(1);
    if (pagination) {
      pagination.currentPage = 1;
      pagination.ensureCurrentPageInRange();
    }
    searchTimeout = setTimeout(() => performSearch(query, 1), 350);
  });
}

async function performSearch(query, page = 1) {
  const grid = document.getElementById("seriesGrid");
  const paginator = document.getElementById("seriesPagination");
  const paginatorTop = document.getElementById("seriesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Searching...</p>`;
  isSearchMode = true;
  currentPage = page;
  
  // Atualizar URL sem disparar onPageChange (evitar loop infinito)
  updateURL(page);
  
  // Atualizar estado interno da paginação sem disparar callbacks
  if (pagination) {
    pagination.currentPage = page;
    pagination.ensureCurrentPageInRange();
  }

  const data = await searchSeries(query, page);
  const series = data.results || [];
  searchTotalPages = data.totalPages || 0;

  if (series.length === 0) {
    grid.innerHTML = `<p class="text-gray-400">No series found.</p>`;
    if (pagination) {
      pagination.render("seriesPaginationTop", "seriesPagination");
    }
    return;
  }

  grid.innerHTML = series.map(renderSeriesCard).join("");

  // Aplicar padding do grid no modo app
  applyAllSeriesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.series-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allseriesPage', page.toString());
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allseriesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("seriesPaginationTop", "seriesPagination");
  }
}

async function loadSeries() {
  const grid = document.getElementById("seriesGrid");
  const paginator = document.getElementById("seriesPagination");
  const paginatorTop = document.getElementById("seriesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  const data = await getPopularSeries(currentPage);
  const series = data.results || [];
  totalPages = Math.min(data.totalPages || 0, 500);

  grid.innerHTML = series.map(renderSeriesCard).join("");

  // Aplicar padding do grid no modo app
  applyAllSeriesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.series-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allseriesPage', page.toString());
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allseriesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("seriesPaginationTop", "seriesPagination");
  }
}

function renderSeriesCard(show) {
  return `
    <div class="series-card bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 group cursor-pointer relative">
      <a href="allserie.html?id=${show.id}" data-page="${currentPage}" class="block series-card-link">
        <img src="${show.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-100 object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold line-clamp-1 hover:text-green-400">${show.title}</h3>
          <p class="text-xs text-gray-400">${show.year}</p>
        </div>
      </a>
    </div>
  `;
}

// ✅ PAGINATION agora é gerido pelo PaginationManager (já configurado no início)

function setupFilter() {
  const filterBtn = document.getElementById("filterSeriesBtn");
  const filterModal = document.getElementById("filterSeriesModal");
  const closeBtn = document.getElementById("closeFilterSeriesModal");
  const clearBtn = document.getElementById("clearFiltersBtn");

  if (!filterBtn || !filterModal) return;

  // Abrir modal
  filterBtn.addEventListener("click", () => {
    filterModal.classList.remove("hidden");
    filterModal.classList.add("flex");
    // Restaurar estado dos filtros ou mostrar primeira seção por padrão
    setTimeout(() => {
      if (currentFilters.topRating || 
          (currentFilters.genres && currentFilters.genres.length > 0) ||
          currentFilters.year) {
        restoreFilterState();
      } else {
        showSection('topRating');
      }
    }, 100);
  });

  // Fechar modal
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Fechar ao clicar fora
  filterModal.addEventListener("click", (e) => {
    if (e.target === filterModal) {
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    }
  });

  // Botões de navegação entre seções
  const topRatingBtn = document.getElementById("filterTopRatingBtn");
  const genreBtn = document.getElementById("filterGenreBtn");
  const yearBtn = document.getElementById("filterYearBtn");

  const topRatingSection = document.getElementById("topRatingSection");
  const genreSection = document.getElementById("genreSection");
  const yearSection = document.getElementById("yearSection");

  function showSection(section) {
    topRatingSection.classList.add("hidden");
    genreSection.classList.add("hidden");
    yearSection.classList.add("hidden");
    
    topRatingBtn.classList.remove("bg-green-600");
    topRatingBtn.classList.add("bg-gray-800");
    genreBtn.classList.remove("bg-green-600");
    genreBtn.classList.add("bg-gray-800");
    yearBtn.classList.remove("bg-green-600");
    yearBtn.classList.add("bg-gray-800");
    
    if (section === 'topRating') {
      topRatingSection.classList.remove("hidden");
      topRatingBtn.classList.remove("bg-gray-800");
      topRatingBtn.classList.add("bg-green-600");
    } else if (section === 'genre') {
      genreSection.classList.remove("hidden");
      genreBtn.classList.remove("bg-gray-800");
      genreBtn.classList.add("bg-green-600");
    } else if (section === 'year') {
      yearSection.classList.remove("hidden");
      yearBtn.classList.remove("bg-gray-800");
      yearBtn.classList.add("bg-green-600");
    }
  }

  if (topRatingBtn) topRatingBtn.addEventListener("click", () => showSection('topRating'));
  if (genreBtn) genreBtn.addEventListener("click", () => showSection('genre'));
  if (yearBtn) yearBtn.addEventListener("click", () => showSection('year'));

  // Top Rating
  const applyTopRatingBtn = document.getElementById("applyTopRatingBtn");
  if (applyTopRatingBtn) {
    applyTopRatingBtn.addEventListener("click", () => {
      // Só ativar o topRating, mantendo géneros/ano se já existirem
      currentFilters = {
        ...currentFilters,
        topRating: true
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      sessionStorage.setItem('allseriesPage', '1');
      updateURL(1);
      loadFilteredSeries(1);
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Genre Tags
  const genreTags = document.querySelectorAll(".genre-tag");
  const selectedGenres = new Set();
  
  genreTags.forEach(tag => {
    tag.addEventListener("click", () => {
      const genreId = tag.getAttribute("data-genre-id");
      if (selectedGenres.has(genreId)) {
        selectedGenres.delete(genreId);
        tag.classList.remove("bg-green-600", "border-green-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      } else {
        selectedGenres.add(genreId);
        tag.classList.remove("bg-gray-800", "border-gray-600");
        tag.classList.add("bg-green-600", "border-green-500");
      }
    });
  });

  const applyGenreBtn = document.getElementById("applyGenreBtn");
  if (applyGenreBtn) {
    applyGenreBtn.addEventListener("click", () => {
      // Atualizar apenas os géneros, mantendo topRating/year
      currentFilters = {
        ...currentFilters,
        genres: Array.from(selectedGenres)
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      sessionStorage.setItem('allseriesPage', '1');
      updateURL(1);
      loadFilteredSeries(1);
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Year Filter
  const applyYearBtn = document.getElementById("applyYearBtn");
  if (applyYearBtn) {
    applyYearBtn.addEventListener("click", () => {
      const yearInput = document.getElementById("yearInput");
      const year = yearInput.value ? parseInt(yearInput.value, 10) : null;
      
      if (!year || year < 1900 || year > 2030) {
        alert("Please enter a valid year between 1900 and 2030");
        return;
      }
      
      // Atualizar apenas o ano, mantendo topRating/genres
      currentFilters = {
        ...currentFilters,
        year: year
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      sessionStorage.setItem('allseriesPage', '1');
      updateURL(1);
      loadFilteredSeries(1);
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Limpar filtros
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // Reset genre tags
      genreTags.forEach(tag => {
        tag.classList.remove("bg-green-600", "border-green-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      });
      selectedGenres.clear();
      
      // Reset year input
      const yearInput = document.getElementById("yearInput");
      if (yearInput) yearInput.value = "";
      
      currentFilters = {
        topRating: false,
        genres: [],
        year: null
      };
      // Remover filtros do sessionStorage
      sessionStorage.removeItem('allseriesFilters');
      isFilterMode = false;
      currentPage = 1;
      updateURL(1);
      loadSeries();
      
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }
  
  // Restaurar estado visual dos filtros quando abrir o modal
  function restoreFilterState() {
    if (currentFilters.topRating) {
      showSection('topRating');
    } else if (currentFilters.genres && currentFilters.genres.length > 0) {
      showSection('genre');
      // Restaurar tags selecionadas
      currentFilters.genres.forEach(genreId => {
        const tag = document.querySelector(`.genre-tag[data-genre-id="${genreId}"]`);
        if (tag) {
          selectedGenres.add(genreId);
          tag.classList.remove("bg-gray-800", "border-gray-600");
          tag.classList.add("bg-green-600", "border-green-500");
        }
      });
    } else if (currentFilters.year) {
      showSection('year');
      const yearInput = document.getElementById("yearInput");
      if (yearInput) yearInput.value = currentFilters.year.toString();
    }
  }
  
  // Guardar referência da função para usar no evento de abrir modal
  window.restoreFilterState = restoreFilterState;
}

async function loadFilteredSeries(page = 1) {
  const grid = document.getElementById("seriesGrid");
  const paginator = document.getElementById("seriesPagination");
  const paginatorTop = document.getElementById("seriesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  const data = await discoverSeries(page, currentFilters);
  const series = data.results || [];
  totalPages = Math.min(data.totalPages || 0, 500);

  if (series.length === 0) {
    grid.innerHTML = `<p class="text-gray-400">No series found with these filters.</p>`;
    if (pagination) {
      pagination.render("seriesPaginationTop", "seriesPagination");
    }
    return;
  }

  grid.innerHTML = series.map(renderSeriesCard).join("");

  // Aplicar padding do grid no modo app
  applyAllSeriesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.series-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allseriesPage', page.toString());
      sessionStorage.setItem('allseriesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allseriesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("seriesPaginationTop", "seriesPagination");
  }
}

