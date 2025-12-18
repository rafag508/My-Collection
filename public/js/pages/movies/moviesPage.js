// src/pages/moviesPage.js

import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { storageService } from "../../modules/storageService.js";

import {
  getAllMovies,
  removeMovie,
  saveMoviesOrder,
  getMoviesOrder
} from "../../modules/movies/moviesDataManager.js";

import { toggleMovieWatched, getAllWatchedStates } from "../../modules/movies/moviesProgress.js";
import { toastSuccess, toastError } from "../../ui/toast.js";
import { setupAddMoviesModal } from "./addMoviesPage.js";
import { smartSyncAllMovies } from "../../modules/movies/moviesSmartSync.js";
import { t as translate } from "../../modules/idioma.js";
import { getFavoriteMovies } from "../../modules/movies/moviesFavorites.js";

// ✅ IMPORTAR MÓDULOS COMPARTILHADOS
import { URLStateManager } from "../../modules/shared/urlStateManager.js";
import { PaginationManager } from "../../modules/shared/pagination.js";
import { SearchHandler } from "../../modules/shared/searchHandler.js";
import { ReorderModal } from "../../modules/shared/reorderModal.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let movies = [];
let watched = {};
let editMode = false;
let deleteMode = false;
let selectedForDelete = new Set();
let favoriteMoviesCache = null; // Cache de filmes favoritos

// Mapa auxiliar de ID de género TMDB -> nome (como vem do TMDB)
const MOVIE_GENRE_ID_TO_NAME = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western"
};

// FILTERS (local, para My Movies)
let isFilterMode = false;
let currentFilters = {
  topRating: false,
  genres: [],
  list: null // 'toWatch', 'watched', 'favorites'
};

// PAGINATION
const PAGE_SIZE = 18;
let isSearchMode = false;
let filteredMovies = [];

// Flag para prevenir race condition quando guardamos ordem
let isSavingOrder = false;

// ✅ INSTANCIAR MÓDULOS COMPARTILHADOS
const urlState = new URLStateManager('movies');
let pagination = null; // Será inicializado depois

// Search handler
const searchHandler = new SearchHandler({
  inputId: 'search',
  debounceDelay: 350,
  onSearch: (query) => {
    performSearch(query);
  },
  onClear: () => {
    isSearchMode = false;
    filteredMovies = [];
    if (pagination) {
      pagination.setPage(urlState.getPageFromURL());
    }
    renderMovies();
  }
});

// Reorder modal
const reorderModal = new ReorderModal({
  modalId: 'reorderMoviesModal',
  closeBtnId: 'closeReorderMoviesModal',
  cancelBtnId: 'cancelReorderMoviesBtn',
  saveBtnId: 'saveReorderMoviesBtn',
  gridId: 'reorderMoviesGrid',
  placeholderImage: PLACEHOLDER_IMAGE,
  titleKey: 'reorderMoviesTitle',
  descKey: 'reorderMoviesDesc',
  hoverColor: 'hover:ring-blue-500',
  translate,
  renderItem: (movie, cardHeight) => `
    <div data-id="${movie.id}"
         class="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group cursor-move flex items-center justify-center"
         draggable="true"
         style="height: ${cardHeight}px;">
      <img src="${movie.poster}" 
           data-placeholder="${PLACEHOLDER_IMAGE}"
           alt="${movie.title || ""}" style="width:100%; height:100%; object-fit:fill; border-radius:8px;">
    </div>
  `,
  onSave: async (orderedItems) => {
    console.log("moviesPage.onSave: Recebido orderedItems:", orderedItems ? orderedItems.length : 0, orderedItems ? orderedItems.map(m => m?.id || 'no-id') : []);
    
    // Validação de segurança
    if (!orderedItems || !Array.isArray(orderedItems) || orderedItems.length === 0) {
      console.error("moviesPage.onSave: ERRO - orderedItems inválido ou vazio!");
      toastError(translate("errorSavingOrder") || "Erro ao guardar ordem");
      return;
    }
    
    const newOrder = orderedItems.map(m => {
      if (!m || !m.id) {
        console.warn("moviesPage.onSave: Item sem ID:", m);
      }
      return m?.id;
    }).filter(id => id !== undefined && id !== null);
    
    console.log("moviesPage.onSave: Guardando nova ordem:", newOrder);
    
    if (newOrder.length === 0) {
      console.error("moviesPage.onSave: ERRO - Nova ordem está vazia após processamento!");
      toastError(translate("errorSavingOrder") || "Erro ao guardar ordem");
      return;
    }

    // Guardar a nova ordem
    await saveMoviesOrder(newOrder);
    
    // Reordenar o array local imediatamente
    movies.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    
    console.log("moviesPage.onSave: Ordem após sort:", movies.map(m => m.id));
    
    // Não precisamos de loadOrder() - já temos a ordem correta após saveMoviesOrder() e sort()
    // Não precisamos de sanitizeMovies() - não mudámos os dados dos filmes, apenas a ordem
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    renderMovies();
    toastSuccess(translate("orderSaved"));
  }
});

export async function initMoviesPage() {
  renderNavbar();
  renderFooter();

  // Mostrar tabs apenas no modo app
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  const tabsElement = document.querySelector('.movies-tabs');
  if (tabsElement) {
    if (isAppMode) {
      tabsElement.classList.remove('hidden');
    } else {
      tabsElement.classList.add('hidden');
    }
  }

  // ✅ RESTAURAR ESTADO usando URLStateManager
  const urlPage = urlState.getPageFromURL();
  const cameFromCard = urlState.cameFromCard();
  const savedPage = urlState.restorePageState(urlPage);
  const { filters, isFilterMode: savedIsFilterMode } = urlState.restoreFilters();

  let currentPage = savedPage;
  currentFilters = filters;
  isFilterMode = savedIsFilterMode;

  // 1️⃣ CARREGAR CACHE LOCAL IMEDIATAMENTE (instantâneo)
  const localMovies = await storageService.get("movies", []);
  const localProgress = await storageService.get("movies_progress", {});
  const localOrder = await storageService.get("movies_order", []);

  movies = Array.isArray(localMovies) ? localMovies : [];
  
  // Construir mapa watched
  watched = {};
  for (const [id, data] of Object.entries(localProgress || {})) {
    watched[id] = data.watched || false;
  }

  // Aplicar ordem local
  if (Array.isArray(localOrder) && localOrder.length > 0) {
    const ids = movies.map(m => m.id);
    const missing = ids.filter(id => !localOrder.includes(id));
    const completeOrder = [...localOrder, ...missing];
    movies.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
  }

  // Carregar favoritos em cache (para filtro)
  try {
    favoriteMoviesCache = await getFavoriteMovies();
  } catch (err) {
    console.warn("moviesPage: erro ao carregar favoritos:", err);
    favoriteMoviesCache = [];
  }

  sanitizeMovies();

  // ✅ INICIALIZAR PAGINAÇÃO
  pagination = new PaginationManager({
    pageSize: PAGE_SIZE,
    initialPage: currentPage,
    buttonPrefix: 'movies',
    activeColor: 'bg-blue-600',
    updateURL: (page) => urlState.updateURL(page),
    getTotalItems: () => {
      let moviesToRender = isSearchMode ? filteredMovies : movies;
      if (isFilterMode && !isSearchMode) {
        moviesToRender = applyFilters(movies);
      }
      return moviesToRender.length;
    },
    onPageChange: () => {
      renderMovies();
    }
  });

  pagination.ensureCurrentPageInRange();
  pagination.setupPopStateListener();

  renderMovies();  // ⚡ UI aparece LOGO

  setupButtons();
  searchHandler.setup();
  setupAddMoviesModal();
  reorderModal.setup();
  setupFilter();

  // Adicionar swipe para mudar entre páginas (apenas no modo app)
  if (isAppMode) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwipe = false;
    const mainElement = document.querySelector('main');
    const gridElement = document.getElementById('moviesGrid');

    if (mainElement) {
      mainElement.addEventListener('touchstart', (e) => {
        // Só capturar se não for em um elemento clicável (botão, link, etc.)
        const target = e.target;
        if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
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
        
        // Só considerar swipe se o movimento horizontal for maior que o vertical
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
        const swipeThreshold = 80; // Mínimo de pixels para considerar swipe

        // Só processar se o movimento horizontal for significativo e maior que o vertical
        if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > diffY && pagination) {
          if (diffX > 0) {
            // Swipe para a esquerda = próxima página
            pagination.nextPage();
          } else {
            // Swipe para a direita = página anterior
            pagination.prevPage();
          }
        }

        // Reset
        touchStartX = 0;
        touchStartY = 0;
        touchEndX = 0;
        touchEndY = 0;
        isSwipe = false;
      }, { passive: true });
    }
  }

  // 2️⃣ SINCRONIZAÇÃO INTELIGENTE EM BACKGROUND (não bloqueia)
  // Sincroniza filmes com priorização: filmes visíveis e não vistos primeiro
  // Só executar se não veio de card (para evitar leituras desnecessárias)
  if (!cameFromCard) {
    (async () => {
      const start = (pagination.currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const visibleMovieIds = movies.slice(start, end).map(m => m.id);
      
      smartSyncAllMovies({
        prioritizeVisible: true,
        visibleMovieIds
      }).then(result => {
      if (result.synced > 0) {
        // Recarregar após sincronização usando apenas cache/localStorage.
        // O smartSync já tratou de sincronizar com o Firestore.
        getAllMovies({ syncFromCloud: false }).then(async cloudMovies => {
          if (cloudMovies && Array.isArray(cloudMovies)) {
            movies = cloudMovies;
            await loadOrder();
            sanitizeMovies();
            if (pagination) {
              pagination.ensureCurrentPageInRange();
            }
            renderMovies();
          }
        });
      }
    }).catch(err => {
      console.warn("moviesPage: smartSync failed:", err);
    });
    })();
  }

  // 3️⃣ SINCRONIZAR EM BACKGROUND (não bloqueia)
  // Versão melhorada: sincroniza apenas na primeira vez, no refresh, ou se não veio de card
  const hasSyncedThisSession = sessionStorage.getItem("moviesSynced") === "true";
  // Detecta refresh (F5) - método compatível com browsers modernos
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const isRefresh = navigationEntry?.type === 'reload' || (performance.navigation && performance.navigation.type === 1);
  
  // Se for refresh, limpar flags de sincronização para permitir nova sync
  if (isRefresh) {
    sessionStorage.removeItem("hasSyncedMoviesFromFirestoreOnce");
    sessionStorage.removeItem("hasSyncedMoviesOrderFromFirestoreOnce");
    sessionStorage.removeItem("hasSyncedMoviesProgressFromFirestoreOnce");
  }
  
  // Sincronizar se: primeira vez na sessão OU refresh E não veio de card
  if ((!hasSyncedThisSession || isRefresh) && !cameFromCard) {
    sessionStorage.setItem("moviesSynced", "true");
    getAllMovies().then(async cloudMovies => {
      if (!cloudMovies || !Array.isArray(cloudMovies)) return;
      movies = cloudMovies;
      await loadOrder();  // Re-carregar ordem após sync
      sanitizeMovies();
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      renderMovies();
    }).catch(err => {
      console.warn("moviesPage: getAllMovies sync failed:", err);
    });
  } else {
    // Usar cache (voltou atrás ou já sincronizou sem refresh)
    getAllMovies({ syncFromCloud: false }).then(async cloudMovies => {
      if (!cloudMovies || !Array.isArray(cloudMovies)) return;
      movies = cloudMovies;
      await loadOrder();
      sanitizeMovies();
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      renderMovies();
    }).catch(err => {
      console.warn("moviesPage: getAllMovies from cache failed:", err);
    });
  }

  // Remover flag DEPOIS da verificação de sincronização
  if (cameFromCard) {
    urlState.clearFromCard();
  }

  // Se veio de card, usar apenas cache (sem sincronizar com Firestore)
  // Se for primeira vez ou refresh, sincronizar com Firestore
  const shouldSyncProgress = !cameFromCard;
  const shouldSyncOrder = !cameFromCard;

  getAllWatchedStates({ syncFromCloud: shouldSyncProgress }).then(cloudWatched => {
    if (!cloudWatched) return;
    watched = cloudWatched;
    renderMovies();
  }).catch(err => {
    console.warn("moviesPage: getAllWatchedStates sync failed:", err);
  });

  getMoviesOrder({ syncFromCloud: shouldSyncOrder }).then(cloudOrder => {
    if (!cloudOrder || !Array.isArray(cloudOrder)) return;
    const ids = movies.map(m => m.id);
    const missing = ids.filter(id => !cloudOrder.includes(id));
    const completeOrder = [...cloudOrder, ...missing];
    movies.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
    renderMovies();
  }).catch(err => {
    console.warn("moviesPage: getMoviesOrder sync failed:", err);
  });

  // 4️⃣ Continuar a reagir a eventos
  document.addEventListener("movieAdded", async () => {
    // Depois de adicionar filme, basta recarregar a partir da cache.
    movies = await getAllMovies({ syncFromCloud: false });
    await loadOrder();
    sanitizeMovies();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    renderMovies();
  });

  document.addEventListener("moviesDataSynced", async (e) => {
    movies = e.detail.data;
    await loadOrder();
    sanitizeMovies();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    renderMovies();
  });

  document.addEventListener("moviesOrderSynced", async (e) => {
    // Ignorar syncs se acabámos de guardar uma ordem (prevenir race condition)
    if (isSavingOrder) {
      console.log("moviesPage: Ignorando moviesOrderSynced - acabámos de guardar ordem");
      return;
    }
    
    const cloudOrder = e.detail.data;
    if (Array.isArray(cloudOrder) && cloudOrder.length > 0) {
      const ids = movies.map(m => m.id);
      const missing = ids.filter(id => !cloudOrder.includes(id));
      const completeOrder = [...cloudOrder, ...missing];
      movies.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
    }
    sanitizeMovies();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    renderMovies();
  });

  document.addEventListener("moviesProgressSynced", async (e) => {
    const cloud = e.detail.data;
    watched = {};
    for (const [movieId, data] of Object.entries(cloud)) {
      watched[movieId] = data.watched || false;
    }
    renderMovies();
  });

  // ✅ PopState já está configurado no PaginationManager.setupPopStateListener()
}

async function loadOrder() {
  let order = await getMoviesOrder();
  order = Array.isArray(order) ? order : [];

  const ids = movies.map(m => m.id);
  const missing = ids.filter(id => !order.includes(id));
  order = [...order, ...missing];

  movies.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

async function saveOrder() {
  const grid = document.getElementById("moviesGrid");
  const visibleIds = [...grid.children].map(el => el.getAttribute("data-id"));

  const currentPage = pagination ? pagination.currentPage : 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  
  // Get all movies not currently visible
  const remaining = movies.filter(m => !visibleIds.includes(m.id));
  
  // Split remaining into items before current page and after current page
  const itemsBeforeCurrentPage = start;
  const left = remaining.slice(0, itemsBeforeCurrentPage);
  const right = remaining.slice(itemsBeforeCurrentPage);
  
  // Get visible items in their new order
  const orderedVisible = visibleIds
    .map(id => movies.find(m => m.id === id))
    .filter(Boolean);

  // Combine: items before + visible items (in new order) + items after
  const final = [...left, ...orderedVisible, ...right].map(m => m.id);

  await saveMoviesOrder(final);
  movies.sort((a, b) => final.indexOf(a.id) - final.indexOf(b.id));

  toastSuccess(translate("orderSaved"));
}

function sanitizeMovies() {
  movies = movies.map(m => ({
    id: m.id,
    title: m.title || "Untitled",
    year: m.year || "—",
    poster: m.poster,
    overview: m.overview || "",
    rating: m.rating || 0,
    genres: Array.isArray(m.genres) ? m.genres : []
  }));
}

// ✅ Search agora é gerido pelo SearchHandler (já configurado no início)

function performSearch(query) {
  const searchLower = query.toLowerCase();
  filteredMovies = movies.filter(m => {
    const title = (m.title || "").toLowerCase();
    const year = (m.year || "").toString();
    return title.includes(searchLower) || year.includes(searchLower);
  });

  isSearchMode = true;
  if (pagination) {
    pagination.firstPage();
  }
  renderMovies();
}

function renderMovies() {
  const grid = document.getElementById("moviesGrid");
  if (!grid) return;

  let moviesToRender = isSearchMode ? filteredMovies : movies;

  // Aplicar filtros se estiver em modo de filtro e não em pesquisa
  if (isFilterMode && !isSearchMode) {
    moviesToRender = applyFilters(movies);
  }

  if (!moviesToRender.length) {
    const message = isSearchMode
      ? translate("noMoviesFound")
      : (isFilterMode ? translate("noMoviesFound") : translate("noMoviesAvailable"));
    grid.innerHTML = `<p class="text-gray-400 text-center">${message}</p>`;
    if (pagination) {
      pagination.render("moviesPaginationTop", "moviesPagination");
    }
    return;
  }

  if (pagination) {
    pagination.ensureCurrentPageInRange();
  }
  const pageItems = pagination ? pagination.getPageItems(moviesToRender) : moviesToRender;

  grid.innerHTML = pageItems.map(movie => {
    const isWatched = watched[movie.id];
    const isSelected = selectedForDelete.has(movie.id);

    return `
      <div data-id="${movie.id}"
           class="movie-card bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group relative">

        ${deleteMode ? `
          <button onclick="toggleDeleteSelect('${movie.id}')"
            class="absolute top-2 left-2 text-xl z-10">
            ${isSelected ? "✅" : "⬜"}
          </button>
        ` : ""}

        <div ${(!editMode && !deleteMode) ? `onclick="onMovieCardClick('${movie.id}')" class="cursor-pointer"` : ""}>
          <img src="${movie.poster}" 
               data-placeholder="${PLACEHOLDER_IMAGE}"
               class="w-full h-72 object-fill object-top rounded-t-lg group-hover:opacity-80 transition">
          <div class="p-2 text-center">
            <h3 class="font-semibold hover:text-blue-400">${movie.title}</h3>
            <p class="text-xs text-gray-400">${movie.year}</p>
          </div>
        </div>

        <div class="p-2 text-center">
          <button onclick="event.stopPropagation(); toggleWatched('${movie.id}')"
            class="mt-1 text-xs px-2 py-1 rounded-md ${
              isWatched ? "bg-green-600" : "bg-blue-600"
            } hover:opacity-80">
            ${isWatched ? `✔️ ${translate("viewed")}` : translate("markAsViewed")}
          </button>
        </div>
      </div>`;
  }).join("");

  // Adicionar handlers de erro para imagens após inserir HTML
  grid.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });

  // Drag & drop now handled inside the reorder modal - no per-page drag here
  if (pagination) {
    pagination.render("moviesPaginationTop", "moviesPagination");
  }
}

function setupButtons() {
  const editBtn = document.getElementById("editMoviesBtn");
  const moveBtn = document.getElementById("moveMoviesBtn");
  const delBtn = document.getElementById("deleteMoviesBtn");
  const confirmBtn = document.getElementById("confirmDeleteMoviesBtn");

  editBtn.addEventListener("click", () => {
    editMode = !editMode;
    // Atualizar ícone do botão (✏️ ↔ 🚪) tal como em seriesPage
    editBtn.textContent = editMode ? "🚪" : "✏️";
    moveBtn.classList.toggle("hidden", !editMode);
    delBtn.classList.toggle("hidden", !editMode);
    confirmBtn.classList.add("hidden");
    deleteMode = false;
    
    // Debug do emoji quando o botão é mostrado
    if (editMode && delBtn) {
      setTimeout(() => {
        const computedStyle = window.getComputedStyle(delBtn);
        const beforeStyle = window.getComputedStyle(delBtn, '::before');
        console.log('🔍 [Emoji Debug] Botão deleteMoviesBtn visível');
        console.log('🔍 [Emoji Debug] Background:', computedStyle.backgroundColor);
        console.log('🔍 [Emoji Debug] Color:', computedStyle.color);
        console.log('🔍 [Emoji Debug] Mix-blend-mode:', computedStyle.mixBlendMode);
        console.log('🔍 [Emoji Debug] ::before content:', beforeStyle.content);
        console.log('🔍 [Emoji Debug] ::before background:', beforeStyle.backgroundColor);
        console.log('🔍 [Emoji Debug] ::before z-index:', beforeStyle.zIndex);
      }, 100);
    }
    
    renderMovies();
  });

  moveBtn.addEventListener("click", () => {
    reorderModal.open(movies);
  });

  delBtn.addEventListener("click", () => {
    deleteMode = !deleteMode;
    confirmBtn.classList.toggle("hidden", !deleteMode);
    renderMovies();
  });

  confirmBtn.addEventListener("click", confirmDelete);
}

// ========== FILTER (Top Rating + Genre + Lists) ==========
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
    // Restaurar estado dos filtros ou mostrar primeira seção por padrão
    setTimeout(() => {
      if (
        currentFilters.topRating ||
        (currentFilters.genres && currentFilters.genres.length > 0) ||
        currentFilters.list
      ) {
        restoreFilterState();
      } else {
        showSection("topRating");
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
  const listBtn = document.getElementById("filterListBtn");

  const topRatingSection = document.getElementById("topRatingSection");
  const genreSection = document.getElementById("genreSection");
  const listSection = document.getElementById("listSection");

  function showSection(section) {
    topRatingSection.classList.add("hidden");
    genreSection.classList.add("hidden");
    listSection.classList.add("hidden");

    topRatingBtn.classList.remove("bg-blue-600");
    topRatingBtn.classList.add("bg-gray-800");
    genreBtn.classList.remove("bg-blue-600");
    genreBtn.classList.add("bg-gray-800");
    listBtn.classList.remove("bg-blue-600");
    listBtn.classList.add("bg-gray-800");

    if (section === "topRating") {
      topRatingSection.classList.remove("hidden");
      topRatingBtn.classList.remove("bg-gray-800");
      topRatingBtn.classList.add("bg-blue-600");
    } else if (section === "genre") {
      genreSection.classList.remove("hidden");
      genreBtn.classList.remove("bg-gray-800");
      genreBtn.classList.add("bg-blue-600");
    } else if (section === "list") {
      listSection.classList.remove("hidden");
      listBtn.classList.remove("bg-gray-800");
      listBtn.classList.add("bg-blue-600");
    }
  }

  if (topRatingBtn) topRatingBtn.addEventListener("click", () => showSection("topRating"));
  if (genreBtn) genreBtn.addEventListener("click", () => showSection("genre"));
  if (listBtn) listBtn.addEventListener("click", () => showSection("list"));

  // Top Rating
  const applyTopRatingBtn = document.getElementById("applyTopRatingBtn");
  if (applyTopRatingBtn) {
    applyTopRatingBtn.addEventListener("click", () => {
      // Só ativar o topRating, mantendo géneros/list se já existirem
      currentFilters = {
        ...currentFilters,
        topRating: true
      };
      isFilterMode = true;
      isSearchMode = false;
      if (pagination) {
        pagination.firstPage();
      }
      renderMovies();
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Genre Tags
  const genreTags = document.querySelectorAll(".genre-tag");
  const selectedGenres = new Set();

  genreTags.forEach((tag) => {
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
      // Atualizar apenas os géneros, mantendo topRating/list
      currentFilters = {
        ...currentFilters,
        genres: Array.from(selectedGenres)
      };
      isFilterMode = true;
      isSearchMode = false;
      if (pagination) {
        pagination.firstPage();
      }
      renderMovies();
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // List Options
  const listOptionBtns = document.querySelectorAll(".list-option-btn");
  let selectedList = null;

  listOptionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const listType =
        btn.id === "listToWatch"
          ? "toWatch"
          : btn.id === "listWatched"
          ? "watched"
          : "favorites";

      // Toggle selection
      if (selectedList === listType) {
        selectedList = null;
        btn.classList.remove("bg-blue-600", "border-blue-500");
        btn.classList.add("bg-gray-800", "border-gray-600");
      } else {
        // Deselect all
        listOptionBtns.forEach((b) => {
          b.classList.remove("bg-blue-600", "border-blue-500");
          b.classList.add("bg-gray-800", "border-gray-600");
        });
        // Select clicked
        selectedList = listType;
        btn.classList.remove("bg-gray-800", "border-gray-600");
        btn.classList.add("bg-blue-600", "border-blue-500");
      }
    });
  });

  const applyListBtn = document.getElementById("applyListBtn");
  if (applyListBtn) {
    applyListBtn.addEventListener("click", () => {
      // Atualizar apenas a lista (toWatch/watched/favorites), mantendo topRating/genres
      currentFilters = {
        ...currentFilters,
        list: selectedList
      };
      isFilterMode = !!selectedList;
      isSearchMode = false;
      if (pagination) {
        pagination.firstPage();
      }
      renderMovies();
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Limpar filtros
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // Reset genre tags
      genreTags.forEach((tag) => {
        tag.classList.remove("bg-blue-600", "border-blue-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      });
      selectedGenres.clear();

      // Reset list options
      listOptionBtns.forEach((btn) => {
        btn.classList.remove("bg-blue-600", "border-blue-500");
        btn.classList.add("bg-gray-800", "border-gray-600");
      });
      selectedList = null;

      currentFilters = {
        topRating: false,
        genres: [],
        list: null
      };
      isFilterMode = false;
      if (pagination) {
        pagination.firstPage();
      }
      renderMovies();

      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Restaurar estado visual dos filtros quando abrir o modal
  function restoreFilterState() {
    if (currentFilters.topRating) {
      showSection("topRating");
    } else if (currentFilters.genres && currentFilters.genres.length > 0) {
      showSection("genre");
      // Restaurar tags selecionadas
      currentFilters.genres.forEach((genreId) => {
        const tag = document.querySelector(`.genre-tag[data-genre-id="${genreId}"]`);
        if (tag) {
          selectedGenres.add(genreId);
          tag.classList.remove("bg-gray-800", "border-gray-600");
          tag.classList.add("bg-blue-600", "border-blue-500");
        }
      });
    } else if (currentFilters.list) {
      showSection("list");
      // Restaurar opção de lista selecionada
      const listBtnId =
        currentFilters.list === "toWatch"
          ? "listToWatch"
          : currentFilters.list === "watched"
          ? "listWatched"
          : "listFavoritesBtn";
      const listBtn = document.getElementById(listBtnId);
      if (listBtn) {
        selectedList = currentFilters.list;
        listBtn.classList.remove("bg-gray-800", "border-gray-600");
        listBtn.classList.add("bg-blue-600", "border-blue-500");
      }
    }
  }

  // Guardar referência da função para usar no evento de abrir modal
  window.restoreFilterState = restoreFilterState;
}

// Aplica filtros locais à lista de filmes
function applyFilters(list) {
  let filtered = [...list];

  // Top Rating: ordenar por rating (descendente)
  if (currentFilters.topRating) {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // Genre
  if (currentFilters.genres && currentFilters.genres.length > 0) {
    filtered = filtered.filter((m) => {
      if (!m.genres || !Array.isArray(m.genres)) return false;
      return currentFilters.genres.some((rawId) => {
        const idNum = parseInt(rawId, 10);
        const mappedName = MOVIE_GENRE_ID_TO_NAME[idNum] || rawId;
        return m.genres.some((g) => {
          if (typeof g === "string") {
            return g === mappedName;
          }
          if (typeof g === "number") {
            return g === idNum;
          }
          if (typeof g === "object" && g !== null) {
            return g.id === idNum || g.name === mappedName;
          }
          return false;
        });
      });
    });
  }

  // List (To Watch / Watched / Favorites)
  if (currentFilters.list) {
    let favoriteIds = null;
    
    // Usar cache de favoritos se disponível
    if (currentFilters.list === "favorites" && favoriteMoviesCache) {
      favoriteIds = new Set(
        favoriteMoviesCache.map(m => (m.tmdbId || m.id || "").toString())
      );
    }
    
    filtered = filtered.filter((m) => {
      const isMovieWatched = !!watched[m.id];
      if (currentFilters.list === "toWatch") {
        return !isMovieWatched;
      }
      if (currentFilters.list === "watched") {
        return isMovieWatched;
      }
      if (currentFilters.list === "favorites") {
        if (!favoriteIds) return false; // Se não houver cache, não mostrar nada
        const key = (m.tmdbId || m.id || "").toString();
        return favoriteIds.has(key);
      }
      return true;
    });
  }

  return filtered;
}

window.toggleWatched = async function (id) {
  const isWatched = await toggleMovieWatched(id);
  watched[id] = isWatched;
  renderMovies();
};

function toggleDeleteSelect(id) {
  if (selectedForDelete.has(id)) selectedForDelete.delete(id);
  else selectedForDelete.add(id);
  renderMovies();
}
window.toggleDeleteSelect = toggleDeleteSelect;

async function confirmDelete() {
  if (selectedForDelete.size === 0) {
    alert(translate("noMoviesSelected"));
    return;
  }

  const ok = confirm("❌ Tens a certeza que queres eliminar os filmes selecionados?");
  if (!ok) return;

  for (const id of selectedForDelete) {
    await removeMovie(id);
  }

  // Recarregar filmes e re-aplicar ordem local (igual ao initMoviesPage)
  movies = await getAllMovies({ syncFromCloud: false });
  const localOrder = await storageService.get("movies_order", []);
  
  // Aplicar ordem local
  if (Array.isArray(localOrder) && localOrder.length > 0) {
    const ids = movies.map(m => m.id);
    const missing = ids.filter(id => !localOrder.includes(id));
    const completeOrder = [...localOrder, ...missing];
    movies.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
  }
  
  selectedForDelete.clear();
  deleteMode = false;
  if (pagination) {
    pagination.ensureCurrentPageInRange();
  }
  renderMovies();

  toastSuccess(translate("moviesRemoved"));
}

// ✅ PAGINATION agora é gerido pelo PaginationManager (já configurado no início)

// Handler global para clique no card de filme
window.onMovieCardClick = function (id) {
  try {
    // ✅ Guardar estado usando URLStateManager
    if (pagination) {
      urlState.savePageState(pagination.currentPage);
    }
    urlState.saveFilters(currentFilters, isFilterMode);
    urlState.markFromCard();
  } catch (err) {
    console.warn("moviesPage: erro ao guardar estado antes de ir para movie.html:", err);
  }

  window.location.href = `movie.html?id=${id}`;
};


// ✅ REORDER MODAL agora é gerido pelo ReorderModal (já configurado no início)

