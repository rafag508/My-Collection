import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { getPopularMovies, searchMovies, discoverMovies } from "../../modules/tmdbApi.js";
import { toastSuccess } from "../../ui/toast.js";
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
let pagination = null; // Será inicializado no initAllMoviesPage
let totalPages = 0; // Total de páginas atual (para filter/normal)
let currentFilters = {
  topRating: false,
  genres: [],
  year: null,
  upcoming: {
    enabled: false,
    releaseType: '3', // Default: Theatrical
    dateFrom: null,
    dateTo: null
  }
};

// Função helper para aplicar padding do grid no modo app
function applyAllMoviesGridPadding() {
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  if (isAppMode) {
    const grid = document.getElementById('moviesGrid');
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

export async function initAllMoviesPage() {
  renderNavbar();
  renderFooter();
  
  // 🔥 LER PÁGINA DA URL (ou usar 1 como padrão)
  let urlPage = getPageFromURL();
  
  // Verificar referrer para determinar se veio de páginas externas
  const referrer = document.referrer;
  // Se vier de páginas externas (Home, movies, series, etc.), limpar tudo
  // NOTA: allmovie.html NÃO é considerado página externa - é a página de detalhes do filme
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
  
  // Verificar se veio de allmovie.html (página de detalhes)
  // Também verificar se há filtros salvos (indica que pode ter vindo de um card)
  const cameFromMoviePage = referrer && referrer.includes('allmovie.html');
  
  // Verificar se há dados salvos (página e filtros)
  const savedPage = sessionStorage.getItem('allmoviesPage');
  const savedFilters = sessionStorage.getItem('allmoviesFilters');
  const cameFromCard = sessionStorage.getItem('allmoviesFromCard') === 'true';
  
  // Se veio de uma página externa, limpar tudo
  // EXCETO se há filtros salvos E a flag cameFromCard está ativa (significa que veio de um card)
  if (cameFromExternalPage && !(savedFilters && cameFromCard)) {
    sessionStorage.removeItem('allmoviesFromCard');
    sessionStorage.removeItem('allmoviesPage');
    sessionStorage.removeItem('allmoviesFilters');
    currentPage = urlPage === 1 ? 1 : urlPage;
    currentFilters = {
      topRating: false,
      genres: [],
      year: null,
      upcoming: {
        enabled: false,
        releaseType: '3',
        dateFrom: null,
        dateTo: null
      }
    };
    isFilterMode = false;
  } 
  // Se há filtros salvos OU veio de allmovie.html OU tem flag de card OU tem página salva, restaurar
  // IMPORTANTE: Sempre restaurar se houver filtros salvos (a menos que venha de página externa)
  else if (savedFilters || cameFromMoviePage || cameFromCard || savedPage) {
    // Se veio de allmovie.html, garantir que os filtros sejam mantidos
    // (mesmo que a flag cameFromCard não exista mais)
    
    // Remover a flag se existir (já foi usada)
    if (cameFromCard) {
      sessionStorage.removeItem('allmoviesFromCard');
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
                       currentFilters.year ||
                       (currentFilters.upcoming && currentFilters.upcoming.enabled);
      } catch (e) {
        console.warn("❌ Erro ao restaurar filtros:", e);
        currentFilters = {
          topRating: false,
          genres: [],
          year: null,
          upcoming: {
            enabled: false,
            releaseType: '3',
            dateFrom: null,
            dateTo: null
          }
        };
        isFilterMode = false;
      }
    } else {
      // Se não há filtros salvos, usar valores padrão
      currentFilters = {
        topRating: false,
        genres: [],
        year: null,
        upcoming: {
          enabled: false,
          releaseType: '3',
          dateFrom: null,
          dateTo: null
        }
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
      year: null,
      upcoming: {
        enabled: false,
        releaseType: '3',
        dateFrom: null,
        dateTo: null
      }
    };
    isFilterMode = false;
  }
  
  // ✅ INICIALIZAR PAGINAÇÃO
  pagination = new PaginationManager({
    pageSize: PAGE_SIZE,
    initialPage: currentPage,
    buttonPrefix: 'allmovies',
    activeColor: 'bg-blue-600',
    updateURL: (page) => {
      updateURL(page);
      currentPage = page;
      // Save current page and filters to sessionStorage
      sessionStorage.setItem('allmoviesPage', page.toString());
      if (isFilterMode) {
        sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      }
    },
    getTotalItems: () => {
      if (isSearchMode) {
        // Para search, usar searchTotalPages diretamente
        return searchTotalPages > 0 ? searchTotalPages * PAGE_SIZE : PAGE_SIZE;
      }
      // Para filter e normal, usar totalPages
      return totalPages > 0 ? totalPages * PAGE_SIZE : PAGE_SIZE;
    },
    onPageChange: (page) => {
      currentPage = page;
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Verificar o modo e chamar a função apropriada
      if (isSearchMode && currentSearchQuery) {
        performSearch(currentSearchQuery, page);
      } else if (isFilterMode) {
        loadFilteredMovies(page);
      } else {
        loadMovies();
      }
    }
  });

  if (isFilterMode) {
    await loadFilteredMovies(currentPage);
  } else {
    await loadMovies();
  }
  
  // Scroll to top when returning from a card
  window.scrollTo({ top: 0, behavior: "instant" });
  
  setupSearch();
  setupFilter();

  // Mostrar tabs apenas no modo app
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  const tabsElement = document.querySelector('.allmovies-tabs');
  if (tabsElement) {
    if (isAppMode) {
      tabsElement.classList.remove('hidden');
    } else {
      tabsElement.classList.add('hidden');
    }
  }

  // Aplicar padding do grid imediatamente
  applyAllMoviesGridPadding();

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
        if (target.tagName === 'BUTTON' && !target.closest('.movie-card')) {
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
          if (target.closest('.movie-card-link')) {
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
  // Mas precisamos de um listener adicional para atualizar quando o modo muda
  if (pagination) {
    pagination.setupPopStateListener();
  }
}

function setupFilter() {
  const filterBtn = document.getElementById("filterMoviesBtn");
  const filterModal = document.getElementById("filterMoviesModal");
  const closeBtn = document.getElementById("closeFilterMoviesModal");
  const clearBtn = document.getElementById("clearFiltersBtn");

  if (!filterBtn || !filterModal) return;

  // Abrir modal
  filterBtn.addEventListener("click", () => {
    filterModal.classList.remove("hidden");
    filterModal.classList.add("flex");
    // Inicializar valores padrão do upcoming
    initializeUpcomingDefaults();
    // Restaurar estado dos filtros ou mostrar primeira seção por padrão
    setTimeout(() => {
      if (currentFilters.topRating || 
          (currentFilters.genres && currentFilters.genres.length > 0) ||
          currentFilters.year ||
          (currentFilters.upcoming && currentFilters.upcoming.enabled)) {
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
  const upcomingBtn = document.getElementById("filterUpcomingBtn");

  const topRatingSection = document.getElementById("topRatingSection");
  const genreSection = document.getElementById("genreSection");
  const yearSection = document.getElementById("yearSection");
  const upcomingSection = document.getElementById("upcomingSection");

  function showSection(section) {
    topRatingSection.classList.add("hidden");
    genreSection.classList.add("hidden");
    yearSection.classList.add("hidden");
    upcomingSection.classList.add("hidden");
    
    topRatingBtn.classList.remove("bg-blue-600");
    topRatingBtn.classList.add("bg-gray-800");
    genreBtn.classList.remove("bg-blue-600");
    genreBtn.classList.add("bg-gray-800");
    yearBtn.classList.remove("bg-blue-600");
    yearBtn.classList.add("bg-gray-800");
    upcomingBtn.classList.remove("bg-blue-600");
    upcomingBtn.classList.add("bg-gray-800");
    
    if (section === 'topRating') {
      topRatingSection.classList.remove("hidden");
      topRatingBtn.classList.remove("bg-gray-800");
      topRatingBtn.classList.add("bg-blue-600");
    } else if (section === 'genre') {
      genreSection.classList.remove("hidden");
      genreBtn.classList.remove("bg-gray-800");
      genreBtn.classList.add("bg-blue-600");
    } else if (section === 'year') {
      yearSection.classList.remove("hidden");
      yearBtn.classList.remove("bg-gray-800");
      yearBtn.classList.add("bg-blue-600");
    } else if (section === 'upcoming') {
      upcomingSection.classList.remove("hidden");
      upcomingBtn.classList.remove("bg-gray-800");
      upcomingBtn.classList.add("bg-blue-600");
      // Garantir que valores padrão estão preenchidos
      initializeUpcomingDefaults();
    }
  }

  if (topRatingBtn) topRatingBtn.addEventListener("click", () => showSection('topRating'));
  if (genreBtn) genreBtn.addEventListener("click", () => showSection('genre'));
  if (yearBtn) yearBtn.addEventListener("click", () => showSection('year'));
  if (upcomingBtn) upcomingBtn.addEventListener("click", () => showSection('upcoming'));

  // Top Rating
  const applyTopRatingBtn = document.getElementById("applyTopRatingBtn");
  if (applyTopRatingBtn) {
    applyTopRatingBtn.addEventListener("click", () => {
      // Só ativar o topRating, mantendo outros filtros (genre/year/upcoming)
      currentFilters = {
        ...currentFilters,
        topRating: true
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      updateURL(1);
      loadFilteredMovies(1);
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
        tag.classList.remove("bg-blue-600", "border-blue-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      } else {
        selectedGenres.add(genreId);
        tag.classList.remove("bg-gray-800", "border-gray-600");
        tag.classList.add("bg-blue-600", "border-blue-500");
      }
    });
  });

  const applyGenreBtn = document.getElementById("applyGenreBtn");
  if (applyGenreBtn) {
    applyGenreBtn.addEventListener("click", () => {
      // Atualizar apenas os géneros, mantendo topRating/year/upcoming
      currentFilters = {
        ...currentFilters,
        genres: Array.from(selectedGenres)
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      updateURL(1);
      loadFilteredMovies(1);
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
      
      // Atualizar apenas o ano
      currentFilters = {
        ...currentFilters,
        year: year
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      updateURL(1);
      loadFilteredMovies(1);
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Upcoming Release Type Buttons
  const releaseTypeButtons = document.querySelectorAll(".release-type-btn");
  let selectedReleaseType = '3'; // Default: Theatrical
  
  releaseTypeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      releaseTypeButtons.forEach(b => {
        b.classList.remove("bg-blue-600");
        b.classList.add("bg-gray-800");
      });
      btn.classList.remove("bg-gray-800");
      btn.classList.add("bg-blue-600");
      selectedReleaseType = btn.getAttribute("data-release-type");
    });
  });

  const applyUpcomingBtn = document.getElementById("applyUpcomingBtn");
  if (applyUpcomingBtn) {
    applyUpcomingBtn.addEventListener("click", () => {
      const dateFrom = document.getElementById("upcomingDateFrom").value;
      const dateTo = document.getElementById("upcomingDateTo").value;
      
      // Atualizar apenas o bloco upcoming
      currentFilters = {
        ...currentFilters,
        upcoming: {
          enabled: true,
          releaseType: selectedReleaseType,
          dateFrom: dateFrom,
          dateTo: dateTo
        }
      };
      // Guardar filtros no sessionStorage
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      isFilterMode = true;
      isSearchMode = false;
      currentPage = 1;
      updateURL(1);
      loadFilteredMovies(1);
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Limpar filtros
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // Reset genre tags
      genreTags.forEach(tag => {
        tag.classList.remove("bg-blue-600", "border-blue-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      });
      selectedGenres.clear();
      
      // Reset release type
      releaseTypeButtons.forEach(b => {
        b.classList.remove("bg-blue-600");
        b.classList.add("bg-gray-800");
      });
      document.getElementById("releaseTypeTheatrical").classList.remove("bg-gray-800");
      document.getElementById("releaseTypeTheatrical").classList.add("bg-blue-600");
      selectedReleaseType = '3';
      
      // Reset dates
      initializeUpcomingDefaults();
      
      // Reset year input
      const yearInput = document.getElementById("yearInput");
      if (yearInput) yearInput.value = "";
      
      currentFilters = {
        topRating: false,
        genres: [],
        year: null,
        upcoming: { enabled: false }
      };
      // Remover filtros do sessionStorage
      sessionStorage.removeItem('allmoviesFilters');
      isFilterMode = false;
      currentPage = 1;
      updateURL(1);
      loadMovies();
      
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
          tag.classList.add("bg-blue-600", "border-blue-500");
        }
      });
    } else if (currentFilters.year) {
      showSection('year');
      const yearInput = document.getElementById("yearInput");
      if (yearInput) yearInput.value = currentFilters.year.toString();
    } else if (currentFilters.upcoming && currentFilters.upcoming.enabled) {
      showSection('upcoming');
      // Restaurar release type
      const releaseTypeBtn = document.querySelector(`.release-type-btn[data-release-type="${currentFilters.upcoming.releaseType}"]`);
      if (releaseTypeButtons && releaseTypeBtn) {
        releaseTypeButtons.forEach(b => {
          b.classList.remove("bg-blue-600");
          b.classList.add("bg-gray-800");
        });
        releaseTypeBtn.classList.remove("bg-gray-800");
        releaseTypeBtn.classList.add("bg-blue-600");
        selectedReleaseType = currentFilters.upcoming.releaseType;
      }
      // Restaurar datas
      if (currentFilters.upcoming.dateFrom) {
        const dateFromInput = document.getElementById("upcomingDateFrom");
        if (dateFromInput) dateFromInput.value = currentFilters.upcoming.dateFrom;
      }
      if (currentFilters.upcoming.dateTo) {
        const dateToInput = document.getElementById("upcomingDateTo");
        if (dateToInput) dateToInput.value = currentFilters.upcoming.dateTo;
      }
    }
  }
  
  // Guardar referência da função para usar no evento de abrir modal
  window.restoreFilterState = restoreFilterState;
}

function initializeUpcomingDefaults() {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const dateFromInput = document.getElementById("upcomingDateFrom");
  const dateToInput = document.getElementById("upcomingDateTo");
  
  if (dateFromInput && dateToInput) {
    dateFromInput.value = today.toISOString().split('T')[0];
    dateToInput.value = lastDayOfMonth.toISOString().split('T')[0];
  }
  
  // Set default release type to Theatrical
  const releaseTypeButtons = document.querySelectorAll(".release-type-btn");
  releaseTypeButtons.forEach(b => {
    b.classList.remove("bg-blue-600");
    b.classList.add("bg-gray-800");
  });
  const theatricalBtn = document.getElementById("releaseTypeTheatrical");
  if (theatricalBtn) {
    theatricalBtn.classList.remove("bg-gray-800");
    theatricalBtn.classList.add("bg-blue-600");
  }
}

async function loadFilteredMovies(page = 1) {
  const grid = document.getElementById("moviesGrid");
  const paginator = document.getElementById("moviesPagination");
  const paginatorTop = document.getElementById("moviesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  const data = await discoverMovies(page, currentFilters);
  const movies = data.results || [];
  totalPages = Math.min(data.totalPages || 0, 500);

  if (movies.length === 0) {
    grid.innerHTML = `<p class="text-gray-400">No movies found with these filters.</p>`;
    if (pagination) {
      pagination.render("moviesPaginationTop", "moviesPagination");
    }
    return;
  }

  grid.innerHTML = movies.map(movie => renderMovieCard(movie)).join("");

  // Aplicar padding do grid no modo app
  applyAllMoviesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.movie-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allmoviesPage', page.toString());
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allmoviesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("moviesPaginationTop", "moviesPagination");
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
      if (pagination) {
        pagination.setPage(1);
      }
      if (isFilterMode) {
        loadFilteredMovies(1);
      } else {
        loadMovies();
      }
      return;
    }

    currentSearchQuery = query;
    currentPage = 1;
    isFilterMode = false; // Desativar filtros quando pesquisar
    if (pagination) {
      pagination.setPage(1);
    }
    searchTimeout = setTimeout(() => performSearch(query, 1), 350);
  });
}

async function performSearch(query, page = 1) {
  const grid = document.getElementById("moviesGrid");
  const paginator = document.getElementById("moviesPagination");
  const paginatorTop = document.getElementById("moviesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Searching...</p>`;
  isSearchMode = true;
  currentPage = page;
  if (pagination) {
    pagination.setPage(page);
  }

  const data = await searchMovies(query, page);
  const movies = data.results || [];
  searchTotalPages = data.totalPages || 0;

  if (movies.length === 0) {
    grid.innerHTML = `<p class="text-gray-400">No movies found.</p>`;
    if (pagination) {
      pagination.render("moviesPaginationTop", "moviesPagination");
    }
    return;
  }

  grid.innerHTML = movies.map(movie => renderMovieCard(movie)).join("");

  // Aplicar padding do grid no modo app
  applyAllMoviesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.movie-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allmoviesPage', page.toString());
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allmoviesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("moviesPaginationTop", "moviesPagination");
  }
}

async function loadMovies() {
  const grid = document.getElementById("moviesGrid");
  const paginator = document.getElementById("moviesPagination");
  const paginatorTop = document.getElementById("moviesPaginationTop");

  grid.innerHTML = `<p class="text-gray-400">Loading...</p>`;

  const data = await getPopularMovies(currentPage);
  const movies = data.results || [];
  totalPages = Math.min(data.totalPages || 0, 500);

  grid.innerHTML = movies.map(movie => renderMovieCard(movie)).join("");

  // Aplicar padding do grid no modo app
  applyAllMoviesGridPadding();

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Add click handlers to save state when clicking a card
  grid.querySelectorAll('.movie-card-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // Save current page and filters before navigation
      const page = link.getAttribute('data-page') || currentPage;
      sessionStorage.setItem('allmoviesPage', page.toString());
      sessionStorage.setItem('allmoviesFilters', JSON.stringify(currentFilters));
      sessionStorage.setItem('allmoviesFromCard', 'true');
    });
  });

  if (pagination) {
    pagination.render("moviesPaginationTop", "moviesPagination");
  }
}

function renderMovieCard(movie) {
  return `
    <div class="movie-card bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group cursor-pointer relative">
      <a href="allmovie.html?id=${movie.id}" data-page="${currentPage}" class="block movie-card-link">
        <img src="${movie.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-fill object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold hover:text-blue-400">${movie.title}</h3>
          <p class="text-xs text-gray-400">${movie.year}</p>
        </div>
      </a>
    </div>
  `;
}

// ✅ PAGINATION agora é gerido pelo PaginationManager (já configurado no início)


