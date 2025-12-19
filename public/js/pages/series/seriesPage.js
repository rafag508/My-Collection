// src/pages/seriesPage.js

import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import {
  getAllSeries,
  deleteSerie,
  saveSeriesOrder,
  getSeriesOrder
} from "../../modules/series/seriesDataManager.js";
import { storageService } from "../../modules/storageService.js";
import { toastSuccess, toastError } from "../../ui/toast.js";
import { setupAddSeriesModal } from "./addSeriesPage.js";

import {
  syncFirestoreToLocal
} from "../../firebase/sync.js";

import {
  markSerieAsViewed,
  unmarkSerieAsViewed,
  getAllSeriesProgress,
  isSerieCompletelyWatched
} from "../../modules/series/seriesProgress.js";
import { getFavoriteSeries } from "../../modules/series/seriesFavorites.js";
import { t as translate } from "../../modules/idioma.js";
import { smartSyncActiveSeries } from "../../modules/series/seriesSmartSync.js";

// ✅ IMPORTAR MÓDULOS COMPARTILHADOS
import { URLStateManager } from "../../modules/shared/urlStateManager.js";
import { PaginationManager } from "../../modules/shared/pagination.js";
import { SearchHandler } from "../../modules/shared/searchHandler.js";
import { ReorderModal } from "../../modules/shared/reorderModal.js";

// Placeholder SVG para imagens que falham ao carregar (usando &apos; para evitar conflito de aspas)
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns=&apos;http://www.w3.org/2000/svg&apos; width=&apos;500&apos; height=&apos;750&apos;%3E%3Crect fill=&apos;%23374151&apos; width=&apos;500&apos; height=&apos;750&apos;/%3E%3Ctext x=&apos;50%25&apos; y=&apos;50%25&apos; dominant-baseline=&apos;middle&apos; text-anchor=&apos;middle&apos; fill=&apos;%239ca3af&apos; font-size=&apos;24&apos; font-family=&apos;Arial&apos;%3ENo Image%3C/text%3E%3C/svg%3E";

let series = [];
let editMode = false;
let deleteMode = false;
let selectedForDelete = new Set();

// Paginação
const PAGE_SIZE = 18;
let isSearchMode = false;
let filteredSeries = [];

// ✅ Cache de progresso e favoritos (como em movies)
let seriesProgressCache = {};
let favoriteSeriesCache = null;

// Filtros
let isFilterMode = false;
let currentFilters = {
  topRating: false,
  genres: [],
  list: null // 'porVer', 'estouAVer', 'jaVi'
};

// Flag para prevenir race condition quando guardamos ordem
let isSavingOrder = false;

// ✅ INSTANCIAR MÓDULOS COMPARTILHADOS
const urlState = new URLStateManager('series');
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
    filteredSeries = [];
    if (pagination) {
      pagination.setPage(urlState.getPageFromURL());
    }
    renderSeries();
  }
});

// Reorder modal
const reorderModal = new ReorderModal({
  modalId: 'reorderSeriesModal',
  closeBtnId: 'closeReorderSeriesModal',
  cancelBtnId: 'cancelReorderSeriesBtn',
  saveBtnId: 'saveReorderSeriesBtn',
  gridId: 'reorderSeriesGrid',
  placeholderImage: PLACEHOLDER_IMAGE,
  titleKey: 'reorderSeriesTitle',
  descKey: 'reorderSeriesDesc',
  hoverColor: 'hover:ring-green-500',
  translate,
  renderItem: (serie, cardHeight) => `
    <div data-id="${serie.id}"
         class="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 group cursor-move flex items-center justify-center"
         draggable="true"
         style="height: ${cardHeight}px;">
      <img src="${serie.poster}" 
           data-placeholder="${PLACEHOLDER_IMAGE}"
           alt="${serie.title || ""}" style="width:100%; height:100%; object-fit:fill; border-radius:8px;">
    </div>
  `,
  onSave: async (orderedItems) => {
    console.log("seriesPage.onSave: Recebido orderedItems:", orderedItems ? orderedItems.length : 0, orderedItems ? orderedItems.map(s => s?.id || 'no-id') : []);
    
    // Validação de segurança
    if (!orderedItems || !Array.isArray(orderedItems) || orderedItems.length === 0) {
      console.error("seriesPage.onSave: ERRO - orderedItems inválido ou vazio!");
      toastError(translate("errorSavingOrder") || "Erro ao guardar ordem");
      return;
    }
    
    const newOrder = orderedItems.map(s => {
      if (!s || !s.id) {
        console.warn("seriesPage.onSave: Item sem ID:", s);
      }
      return s?.id;
    }).filter(id => id !== undefined && id !== null);
    
    console.log("seriesPage.onSave: Guardando nova ordem:", newOrder);
    
    if (newOrder.length === 0) {
      console.error("seriesPage.onSave: ERRO - Nova ordem está vazia após processamento!");
      toastError(translate("errorSavingOrder") || "Erro ao guardar ordem");
      return;
    }
    
    // Guardar a nova ordem
    await saveSeriesOrder(newOrder);
    
    // Reordenar o array local imediatamente
    series.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    
    console.log("seriesPage.onSave: Ordem após sort:", series.map(s => s.id));
    
    // Ativar flag para ignorar syncs de ordem por um curto período
    isSavingOrder = true;
    setTimeout(() => {
      isSavingOrder = false;
      console.log("seriesPage: isSavingOrder resetado.");
    }, 2000); // Ignorar syncs por 2 segundos
    
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    renderSeries();
    toastSuccess(translate("orderSaved"));
  }
});

// Mapa auxiliar de ID de género TMDB -> nome (como vem do TMDB)
const SERIES_GENRE_ID_TO_NAME = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western"
};

// Listeners para eventos de sincronização de ordem
document.addEventListener("seriesOrderSynced", async (e) => {
  if (isSavingOrder) {
    console.log("seriesPage: Ignorando seriesOrderSynced devido a isSavingOrder.");
    return;
  }
  const cloudOrder = e.detail.data;
  if (Array.isArray(cloudOrder) && cloudOrder.length > 0) {
    const ids = series.map(s => s.id);
    const missing = ids.filter(id => !cloudOrder.includes(id));
    const completeOrder = [...cloudOrder, ...missing];
    series.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
  }
  sanitizeSeries();
  if (pagination) {
    pagination.ensureCurrentPageInRange();
  }
  renderSeries();
});

export async function initSeriesPage() {
  renderNavbar();
  renderFooter();

  // ✅ CARREGAR CACHE DE PROGRESSO E FAVORITOS no início (para applyFilters síncrono)
  seriesProgressCache = await getAllSeriesProgress({ syncFromCloud: false });
  
  // Carregar favoritos em cache (com try-catch para evitar erros)
  try {
    favoriteSeriesCache = await getFavoriteSeries();
  } catch (err) {
    console.warn("seriesPage: erro ao carregar favoritos:", err);
    favoriteSeriesCache = [];
  }

  // ✅ RESTAURAR ESTADO usando URLStateManager
  const urlPage = urlState.getPageFromURL();
  const cameFromCard = urlState.cameFromCard();
  const savedPage = urlState.restorePageState(urlPage);
  const { filters, isFilterMode: savedIsFilterMode } = urlState.restoreFilters();

  currentFilters = filters;
  isFilterMode = savedIsFilterMode;

  // 1️⃣ CARREGAR CACHE LOCAL IMEDIATAMENTE (instantâneo)
  const localSeries = await storageService.get("series", []);
  const localOrder = await storageService.get("series_order", []);

  series = Array.isArray(localSeries) ? localSeries : [];

  // Aplicar ordem local
  if (Array.isArray(localOrder) && localOrder.length > 0) {
    const ids = series.map(s => s.id);
    const missing = ids.filter(id => !localOrder.includes(id));
    const completeOrder = [...localOrder, ...missing];
    series.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
  }

  sanitizeSeries();

  // ✅ INICIALIZAR PAGINAÇÃO
  pagination = new PaginationManager({
    pageSize: PAGE_SIZE,
    initialPage: savedPage,
    buttonPrefix: 'series',
    activeColor: 'bg-green-600',
    translate,
    updateURL: (page) => urlState.updateURL(page),
    getTotalItems: () => {
      let seriesToRender = isSearchMode ? filteredSeries : series;
      if (isFilterMode && !isSearchMode) {
        seriesToRender = applyFilters(series);
      }
      return seriesToRender.length;
    },
    onPageChange: () => {
      renderSeries();
    }
  });

  pagination.ensureCurrentPageInRange();
  pagination.setupPopStateListener();

  await renderSeries();  // ⚡ UI aparece LOGO (progresso já carrega do cache aqui)

  setupButtons();
  searchHandler.setup();
  setupAddSeriesModal();
  reorderModal.setup();
  setupFilter();
  
  // Atualizar textos quando idioma muda
  updatePageTexts();
  document.addEventListener("languageChanged", updatePageTexts);

  // Mostrar tabs apenas no modo app
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  const tabsElement = document.querySelector('.series-tabs');
  if (tabsElement) {
    if (isAppMode) {
      tabsElement.classList.remove('hidden');
    } else {
      tabsElement.classList.add('hidden');
    }
  }

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
        if (target.tagName === 'BUTTON' && !target.closest('.serie-card')) {
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

  // 2️⃣ SINCRONIZAR EM BACKGROUND (não bloqueia)
  // Versão melhorada: sincroniza apenas na primeira vez, no refresh, ou se não veio de card
  const hasSyncedThisSession = sessionStorage.getItem("seriesSynced") === "true";
  // Detecta refresh (F5) - método compatível com browsers modernos
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const isRefresh = navigationEntry?.type === 'reload' || (performance.navigation && performance.navigation.type === 1);
  
  // Se for refresh, limpar flags de sincronização para permitir nova sync
  if (isRefresh) {
    sessionStorage.removeItem("hasSyncedSeriesFromFirestoreOnce");
    sessionStorage.removeItem("hasSyncedSeriesOrderFromFirestoreOnce");
    sessionStorage.removeItem("hasSyncedSeriesProgressFromFirestoreOnce");
  }
  
  // Sincronizar se: primeira vez na sessão OU refresh E não veio de card
  if ((!hasSyncedThisSession || isRefresh) && !cameFromCard) {
    sessionStorage.setItem("seriesSynced", "true");
    getAllSeries().then(async cloudSeries => {
      if (!cloudSeries || !Array.isArray(cloudSeries)) return;
      series = cloudSeries;
      await loadOrder();  // Re-carregar ordem após sync
      sanitizeSeries();
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      await renderSeries();
    }).catch(err => {
      console.warn("seriesPage: getAllSeries sync failed:", err);
    });
  } else {
    // Usar cache (voltou atrás ou já sincronizou sem refresh)
    getAllSeries({ syncFromCloud: false }).then(async cloudSeries => {
      if (!cloudSeries || !Array.isArray(cloudSeries)) return;
      series = cloudSeries;
      await loadOrder();
      sanitizeSeries();
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      await renderSeries();
    }).catch(err => {
      console.warn("seriesPage: getAllSeries from cache failed:", err);
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

  // Sincronizar progresso de séries (similar a movies)
  getAllSeriesProgress({ syncFromCloud: shouldSyncProgress }).then(async cloudProgress => {
    if (!cloudProgress) return;
    // ✅ Atualizar cache de progresso
    seriesProgressCache = cloudProgress;
    // Apenas precisamos de renderizar novamente se necessário
    renderSeries();
  }).catch(err => {
    console.warn("seriesPage: getAllSeriesProgress sync failed:", err);
  });

  getSeriesOrder({ syncFromCloud: shouldSyncOrder }).then(cloudOrder => {
    if (!cloudOrder || !Array.isArray(cloudOrder)) return;
    const ids = series.map(s => s.id);
    const missing = ids.filter(id => !cloudOrder.includes(id));
    const completeOrder = [...cloudOrder, ...missing];
    series.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
    renderSeries();
  }).catch(err => {
    console.warn("seriesPage: getSeriesOrder sync failed:", err);
  });

  // 4️⃣ Continuar a reagir a eventos
  document.addEventListener("serieAutoSynced", async (e) => {
    series = await getAllSeries({ syncFromCloud: false });
    await loadOrder();
    sanitizeSeries();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    await renderSeries();
    // Notificações já são guardadas automaticamente em seriesSync.js
    // e aparecem na página de notificações - não precisa de toast redundante
  });

  document.addEventListener("syncFromCloud", async () => {
    try {
      await syncFirestoreToLocal();
      series = await getAllSeries({ syncFromCloud: false });
      await loadOrder();
      sanitizeSeries();
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      await renderSeries();
      toastSuccess(translate("cloudSynced"));
    } catch (err) {
      console.error("Erro syncFromCloud:", err);
    }
  });

  // Atualiza progressos
  document.addEventListener("serieProgressUpdated", async (e) => {
    const { id } = e.detail;
    if (!series.find(s => s.id === id)) return;
    await renderSeries();
  });

  // Atualizar quando adicionada
  document.addEventListener("seriesAdded", async () => {
    series = await getAllSeries({ syncFromCloud: false });
    await loadOrder();
    sanitizeSeries();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    await renderSeries();
  });

  // Atualizar UI quando dados forem sincronizados da cloud
  document.addEventListener("seriesDataSynced", async (e) => {
    series = e.detail.data;
    await loadOrder();
    sanitizeSeries();
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    await renderSeries();
  });

  // 5️⃣ SINCRONIZAÇÃO INTELIGENTE EM BACKGROUND (não bloqueia)
  // Sincroniza séries ativas com priorização: séries visíveis primeiro
  // Só executar se não veio de card (para evitar leituras desnecessárias)
  if (!cameFromCard) {
    (async () => {
      const start = (pagination.currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const visibleSeriesIds = series.slice(start, end).map(s => s.id);
      
      // Sincronizar com priorização: séries visíveis primeiro
      smartSyncActiveSeries({
        prioritizeVisible: true,
        visibleSeriesIds: visibleSeriesIds
      }).then(result => {
      if (result.synced > 0) {
        // Recarregar após sincronização usando apenas cache/localStorage
        getAllSeries({ syncFromCloud: false }).then(async cloudSeries => {
          if (cloudSeries && Array.isArray(cloudSeries)) {
            series = cloudSeries;
            await loadOrder();
            sanitizeSeries();
            if (pagination) {
              pagination.ensureCurrentPageInRange();
            }
            await renderSeries();
          }
        });
      }
    }).catch(err => {
      console.warn("seriesPage: smartSync failed:", err);
    });
    })();
  }

  // ✅ Evento de sincronização de progresso (quando Firestore → Local sync completa)
  document.addEventListener("seriesProgressSynced", async (e) => {
    const cloudProgress = e.detail.data;
    if (cloudProgress && Object.keys(cloudProgress).length > 0) {
      // ✅ Atualizar cache de progresso
      seriesProgressCache = cloudProgress;
      // Apenas precisamos de renderizar novamente
      renderSeries();
    }
  });

}

async function loadOrder() {
  let order = await getSeriesOrder();
  order = Array.isArray(order) ? order : [];

  const ids = series.map(s => s.id);
  const missing = ids.filter(id => !order.includes(id));
  order = [...order, ...missing];

  series.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

function sanitizeSeries() {
  series = series.map(s => ({
    id: s.id || `tmp-${Math.random().toString(36).slice(2)}`,
    title: s.title || "Sem Título",
    year: s.year || "—",
    poster: s.poster || "./assets/default.jpg",
    seasons: s.seasons || [],
    // Preservar campos usados pelos filtros e pela UI de detalhes
    rating: s.rating || 0,
    genres: Array.isArray(s.genres) ? s.genres : []
  }));
}

async function performSearch(query) {
  const searchLower = query.toLowerCase();
  filteredSeries = series.filter(s => {
    const title = (s.title || "").toLowerCase();
    const year = (s.year || "").toString();
    return title.includes(searchLower) || year.includes(searchLower);
  });

  isSearchMode = true;
  if (pagination) {
    pagination.firstPage();
  }
  await renderSeries();
}

// ========== RENDER ==========
async function renderSeries() {
  const grid = document.getElementById("seriesGrid");
  if (!grid) return;

  let seriesToRender = isSearchMode ? filteredSeries : series;
  
  // Aplicar filtros se estiver em modo de filtro
  if (isFilterMode && !isSearchMode) {
    seriesToRender = applyFilters(series);
  }

  if (!seriesToRender.length) {
    let message = translate("noSeriesAvailable");
    if (isSearchMode) {
      message = translate("noSeriesFound");
    } else if (isFilterMode) {
      message = translate("noSeriesWithFilters");
    }
    grid.innerHTML = `<p class="text-center text-gray-400">${message}</p>`;
    if (pagination) {
      pagination.render("seriesPaginationTop", "seriesPagination");
    }
    return;
  }

  if (pagination) {
    pagination.ensureCurrentPageInRange();
  }

  // Usar PaginationManager para obter items da página
  const pageItems = pagination ? pagination.getPageItems(seriesToRender) : seriesToRender;

  // Usar getAllSeriesProgress que sincroniza em background (mas retorna cache imediato)
  const progress = await getAllSeriesProgress({ syncFromCloud: false });
  
  grid.innerHTML = pageItems.map(show => {
    const serieProgress = progress[show.id] || { watched: {} };
    const isWatched = isSerieCompletelyWatched(show, serieProgress);
    const isSelected = selectedForDelete.has(show.id);

    return `
      <div data-id="${show.id}"
           class="serie-card bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 relative group">
        
        ${deleteMode ? `
          <button onclick="toggleDeleteSelect('${show.id}')"
                  class="absolute top-2 left-2 text-2xl z-10">
            ${isSelected ? "✅" : "⬜"}
          </button>`
        : ""}

        <div ${(!editMode && !deleteMode) ? `onclick="onSeriesCardClick('${show.id}')"` : ""}
             class="cursor-pointer">

          <img src="${show.poster}" 
               data-placeholder="${PLACEHOLDER_IMAGE}"
               class="w-full h-72 object-fill object-top rounded-t-lg group-hover:opacity-80 transition">

          <div class="p-2 text-center">
            <h3 class="font-semibold hover:text-green-400">${show.title}</h3>
            <p class="text-xs text-gray-400">${show.year}</p>
          </div>
        </div>

        <div class="p-2 text-center">
          <button onclick="event.stopPropagation(); toggleWatched('${show.id}')"
            class="mt-1 text-xs px-2 py-1 rounded-md ${isWatched ? "bg-green-600" : "bg-blue-600"} hover:opacity-80">
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

  // Renderizar paginação usando PaginationManager
  if (pagination) {
    pagination.render("seriesPaginationTop", "seriesPagination");
  }
}


// ========== BOTÕES ==========
function setupButtons() {
  const editBtn = document.getElementById("editSeriesBtn");
  const moveBtn = document.getElementById("moveSeriesBtn");
  const deleteBtn = document.getElementById("deleteSeriesBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  editBtn.addEventListener("click", async () => {
    editMode = !editMode;
    editBtn.textContent = editMode ? "🚪" : "✏️";
    moveBtn.classList.toggle("hidden", !editMode);
    deleteBtn.classList.toggle("hidden", !editMode);
    deleteMode = false;
    selectedForDelete.clear();
    confirmDeleteBtn.classList.add("hidden");
    await renderSeries();
  });

  moveBtn.addEventListener("click", () => {
    reorderModal.open(series);
  });

  deleteBtn.addEventListener("click", async () => {
    deleteMode = !deleteMode;
    deleteBtn.classList.toggle("bg-red-700", deleteMode);
    confirmDeleteBtn.classList.toggle("hidden", !deleteMode);
    selectedForDelete.clear();
    await renderSeries();
  });

  confirmDeleteBtn.addEventListener("click", confirmDelete);
}

// ========== WATCHED ==========
window.toggleWatched = async function (id) {
  const serie = series.find(s => s.id === id);
  if (!serie) return;

  const progress = await getAllSeriesProgress({ syncFromCloud: false });
  const serieProgress = progress[id] || { watched: {} };
  const isCurrentlyWatched = isSerieCompletelyWatched(serie, serieProgress);

  if (isCurrentlyWatched) {
    await unmarkSerieAsViewed(id);
  } else {
    await markSerieAsViewed(id, serie);
  }

  // ✅ Atualizar cache de progresso após mudança
  seriesProgressCache = await getAllSeriesProgress({ syncFromCloud: false });

  document.dispatchEvent(new CustomEvent("serieProgressUpdated", { detail: { id } }));
  await renderSeries();
};


// ========== DELETE ==========
async function toggleDeleteSelect(id) {
  if (selectedForDelete.has(id)) selectedForDelete.delete(id);
  else selectedForDelete.add(id);
  await renderSeries();
}
window.toggleDeleteSelect = toggleDeleteSelect;

async function confirmDelete() {
  if (selectedForDelete.size === 0) {
    alert(translate("noSeriesSelected"));
    return;
  }

  if (!confirm("❌ Tens a certeza?")) return;

  for (const id of selectedForDelete) await deleteSerie(id);

  // Recarregar séries e re-aplicar ordem local (igual ao initSeriesPage)
  series = await getAllSeries({ syncFromCloud: false });
  const localOrder = await storageService.get("series_order", []);
  
  // Aplicar ordem local
  if (Array.isArray(localOrder) && localOrder.length > 0) {
    const ids = series.map(s => s.id);
    const missing = ids.filter(id => !localOrder.includes(id));
    const completeOrder = [...localOrder, ...missing];
    series.sort((a, b) => completeOrder.indexOf(a.id) - completeOrder.indexOf(b.id));
  }
  
  selectedForDelete.clear();
  deleteMode = false;

  if (pagination) {
    pagination.ensureCurrentPageInRange();
  }
  await renderSeries();

  toastSuccess(translate("seriesRemoved"));
}



// ========== FILTER ==========
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
          currentFilters.list) {
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
  const listBtn = document.getElementById("filterListBtn");

  const topRatingSection = document.getElementById("topRatingSection");
  const genreSection = document.getElementById("genreSection");
  const listSection = document.getElementById("listSection");

  function showSection(section) {
    topRatingSection.classList.add("hidden");
    genreSection.classList.add("hidden");
    listSection.classList.add("hidden");
    
    topRatingBtn.classList.remove("bg-green-600");
    topRatingBtn.classList.add("bg-gray-800");
    genreBtn.classList.remove("bg-green-600");
    genreBtn.classList.add("bg-gray-800");
    listBtn.classList.remove("bg-green-600");
    listBtn.classList.add("bg-gray-800");
    
    if (section === 'topRating') {
      topRatingSection.classList.remove("hidden");
      topRatingBtn.classList.remove("bg-gray-800");
      topRatingBtn.classList.add("bg-green-600");
    } else if (section === 'genre') {
      genreSection.classList.remove("hidden");
      genreBtn.classList.remove("bg-gray-800");
      genreBtn.classList.add("bg-green-600");
    } else if (section === 'list') {
      listSection.classList.remove("hidden");
      listBtn.classList.remove("bg-gray-800");
      listBtn.classList.add("bg-green-600");
    }
  }

  if (topRatingBtn) topRatingBtn.addEventListener("click", () => showSection('topRating'));
  if (genreBtn) genreBtn.addEventListener("click", () => showSection('genre'));
  if (listBtn) listBtn.addEventListener("click", () => showSection('list'));

  // Top Rating
  const applyTopRatingBtn = document.getElementById("applyTopRatingBtn");
  if (applyTopRatingBtn) {
    applyTopRatingBtn.addEventListener("click", async () => {
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
      await renderSeries();
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
    applyGenreBtn.addEventListener("click", async () => {
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
      await renderSeries();
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // List Options
  const listOptionBtns = document.querySelectorAll(".list-option-btn");
  let selectedList = null;
  
  listOptionBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const listType =
        btn.id === 'listPorVer' ? 'porVer' :
        btn.id === 'listEstouAVer' ? 'estouAVer' :
        btn.id === 'listJaVi' ? 'jaVi' :
        'favorites';
      
      // Toggle selection
      if (selectedList === listType) {
        selectedList = null;
        btn.classList.remove("bg-green-600", "border-green-500");
        btn.classList.add("bg-gray-800", "border-gray-600");
      } else {
        // Deselect all
        listOptionBtns.forEach(b => {
          b.classList.remove("bg-green-600", "border-green-500");
          b.classList.add("bg-gray-800", "border-gray-600");
        });
        // Select clicked
        selectedList = listType;
        btn.classList.remove("bg-gray-800", "border-gray-600");
        btn.classList.add("bg-green-600", "border-green-500");
      }
    });
  });

  const applyListBtn = document.getElementById("applyListBtn");
  if (applyListBtn) {
    applyListBtn.addEventListener("click", async () => {
      // Atualizar apenas a lista (porVer/estouAVer/jaVi/favorites), mantendo topRating/genres
      currentFilters = {
        ...currentFilters,
        list: selectedList
      };
      isFilterMode = true;
      isSearchMode = false;
      if (pagination) {
        pagination.firstPage();
      }
      await renderSeries();
      filterModal.classList.add("hidden");
      filterModal.classList.remove("flex");
    });
  }

  // Limpar filtros
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      // Reset genre tags
      genreTags.forEach(tag => {
        tag.classList.remove("bg-green-600", "border-green-500");
        tag.classList.add("bg-gray-800", "border-gray-600");
      });
      selectedGenres.clear();
      
      // Reset list options
      listOptionBtns.forEach(btn => {
        btn.classList.remove("bg-green-600", "border-green-500");
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
      await renderSeries();
      
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
    } else if (currentFilters.list) {
      showSection('list');
      // Restaurar opção de lista selecionada
      const listBtnId =
        currentFilters.list === 'porVer' ? 'listPorVer' :
        currentFilters.list === 'estouAVer' ? 'listEstouAVer' :
        currentFilters.list === 'jaVi' ? 'listJaVi' :
        'listFavoritesBtn';
      const listBtn = document.getElementById(listBtnId);
      if (listBtn) {
        selectedList = currentFilters.list;
        listBtn.classList.remove("bg-gray-800", "border-gray-600");
        listBtn.classList.add("bg-green-600", "border-green-500");
      }
    }
  }
  
  // Guardar referência da função para usar no evento de abrir modal
  window.restoreFilterState = restoreFilterState;
}

// Função para aplicar filtros
function applyFilters(seriesList) {
  let filtered = [...seriesList];
  const progress = seriesProgressCache; // ✅ Usar cache em vez de await
  let favoriteIds = null;

  // Filtro por Top Rating
  if (currentFilters.topRating) {
    // Não excluir séries sem rating, apenas ordenar pela classificação (descendente)
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // Filtro por Genre (se as séries tiverem genres)
  if (currentFilters.genres && currentFilters.genres.length > 0) {
    filtered = filtered.filter(s => {
      if (!s.genres || !Array.isArray(s.genres)) return false;
      return currentFilters.genres.some(rawId => {
        const idNum = parseInt(rawId, 10);
        const mappedName = SERIES_GENRE_ID_TO_NAME[idNum] || rawId;
        return s.genres.some(g => {
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

  // Filtro por List
  if (currentFilters.list) {
    if (currentFilters.list === 'favorites') {
      // ✅ Usar cache em vez de await
      favoriteIds = new Set(
        (favoriteSeriesCache || []).map(s => (s.tmdbId || s.id || "").toString())
      );
    }

    filtered = filtered.filter(s => {
      const serieProgress = progress[s.id] || { watched: {} };
      const watchedMap = serieProgress.watched || {};
      const hasWatchedEpisodes = Object.keys(watchedMap).length > 0 && Object.values(watchedMap).some(v => v === true);
      const isCompletelyWatched = isSerieCompletelyWatched(s, serieProgress);

      if (currentFilters.list === 'porVer') {
        // Por ver: nenhum episódio visto
        return !hasWatchedEpisodes;
      } else if (currentFilters.list === 'estouAVer') {
        // Estou a ver: alguns episódios vistos mas não completamente
        return hasWatchedEpisodes && !isCompletelyWatched;
      } else if (currentFilters.list === 'jaVi') {
        // Já vi: completamente vista
        return isCompletelyWatched;
      } else if (currentFilters.list === 'favorites') {
        const key = (s.tmdbId || s.id || "").toString();
        return favoriteIds ? favoriteIds.has(key) : false;
      }
      return true;
    });
  }

  return filtered;
}

// Handler global para clique no card de série
window.onSeriesCardClick = function (id) {
  try {
    // Guardar estado usando URLStateManager
    if (pagination) {
      urlState.savePageState(pagination.currentPage);
    }
    urlState.saveFilters(currentFilters, isFilterMode);
    urlState.markFromCard();

    window.location.href = `serie.html?id=${id}`;
  } catch (err) {
    console.warn("seriesPage: erro ao guardar estado antes de ir para serie.html:", err);
  }
};

function updatePageTexts() {
  // Atualizar título
  const titleEl = document.querySelector('h1.text-3xl');
  if (titleEl) titleEl.textContent = `📺 ${translate('mySeries')}`;
  
  // Atualizar tabs
  const tabMySeries = document.querySelector('.series-tabs a[href="/series.html"]');
  const tabAllSeries = document.querySelector('.series-tabs a[href="/allseries.html"]');
  if (tabMySeries) tabMySeries.textContent = translate('mySeries');
  if (tabAllSeries) tabAllSeries.textContent = translate('allSeries');
  
  // Atualizar botões
  const filterBtn = document.getElementById('filterSeriesBtn');
  if (filterBtn) {
    const svg = filterBtn.querySelector('svg');
    filterBtn.innerHTML = '';
    if (svg) filterBtn.appendChild(svg);
    filterBtn.appendChild(document.createTextNode(translate('filter')));
  }
  
  const addBtn = document.getElementById('addSeriesBtn');
  if (addBtn) {
    const svg = addBtn.querySelector('svg');
    addBtn.innerHTML = '';
    if (svg) addBtn.appendChild(svg);
    addBtn.appendChild(document.createTextNode(translate('addSeries')));
  }
  
  // Atualizar modal de filtros
  const filterModalTitle = document.querySelector('#filterSeriesModal h2');
  if (filterModalTitle) filterModalTitle.textContent = translate('filterSeries');
  
  const topRatingBtn = document.querySelector('#filterSeriesModal #filterTopRatingBtn');
  if (topRatingBtn) topRatingBtn.textContent = translate('topRating');
  
  const genreBtn = document.querySelector('#filterSeriesModal #filterGenreBtn');
  if (genreBtn) genreBtn.textContent = translate('genre');
  
  const listBtn = document.querySelector('#filterSeriesModal #filterListBtn');
  if (listBtn) listBtn.textContent = translate('lists');
  
  const topRatingDesc = document.querySelector('#filterSeriesModal #topRatingSection p');
  if (topRatingDesc) topRatingDesc.textContent = translate('seriesSortedByRating');
  
  const applyTopRatingBtn = document.querySelector('#filterSeriesModal #applyTopRatingBtn');
  if (applyTopRatingBtn) applyTopRatingBtn.textContent = translate('applyTopRatingFilter');
  
  const selectGenresLabel = document.querySelector('#filterSeriesModal #genreSection label');
  if (selectGenresLabel) selectGenresLabel.textContent = translate('selectGenres');
  
  const applyGenreBtn = document.querySelector('#filterSeriesModal #applyGenreBtn');
  if (applyGenreBtn) applyGenreBtn.textContent = translate('applyGenreFilter');
  
  const selectListLabel = document.querySelector('#filterSeriesModal #listSection label');
  if (selectListLabel) selectListLabel.textContent = translate('selectList');
  
  const listPorVerBtn = document.getElementById('listPorVer');
  if (listPorVerBtn) listPorVerBtn.textContent = translate('toWatch');
  
  const listEstouAVerBtn = document.getElementById('listEstouAVer');
  if (listEstouAVerBtn) listEstouAVerBtn.textContent = translate('watching');
  
  const listJaViBtn = document.getElementById('listJaVi');
  if (listJaViBtn) listJaViBtn.textContent = translate('watched');
  
  const listFavoritesBtn = document.getElementById('listFavoritesBtn');
  if (listFavoritesBtn) listFavoritesBtn.textContent = translate('favorites');
  
  const applyListBtn = document.querySelector('#filterSeriesModal #applyListBtn');
  if (applyListBtn) applyListBtn.textContent = translate('applyListFilter');
  
  const clearFiltersBtn = document.querySelector('#filterSeriesModal #clearFiltersBtn');
  if (clearFiltersBtn) clearFiltersBtn.textContent = translate('clearAllFilters');
  
  // Atualizar géneros de séries
  const seriesGenreMap = {
    'Action & Adventure': translate('genreActionAdventure'),
    'Animation': translate('genreAnimation'),
    'Comedy': translate('genreComedy'),
    'Crime': translate('genreCrime'),
    'Documentary': translate('genreDocumentary'),
    'Drama': translate('genreDrama'),
    'Family': translate('genreFamily'),
    'Kids': translate('genreKids'),
    'Mystery': translate('genreMystery'),
    'News': translate('genreNews'),
    'Reality': translate('genreReality'),
    'Sci-Fi & Fantasy': translate('genreSciFiFantasy'),
    'Soap': translate('genreSoap'),
    'Talk': translate('genreTalk'),
    'War & Politics': translate('genreWarPolitics'),
    'Western': translate('genreWestern')
  };
  
  document.querySelectorAll('#filterSeriesModal .genre-tag').forEach(btn => {
    const originalText = btn.textContent.trim();
    if (seriesGenreMap[originalText]) {
      btn.textContent = seriesGenreMap[originalText];
    }
  });
  
  // Atualizar título da página
  document.title = translate('mySeries');
}

