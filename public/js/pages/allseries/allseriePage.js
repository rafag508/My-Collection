import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { getSerieById, getAllSeries, addSerie } from "../../modules/series/seriesDataManager.js";
import { getSeriesDetails, getSeriesVideos } from "../../modules/tmdbApi.js";
import { toastSuccess } from "../../ui/toast.js";
import { t as translate } from "../../modules/idioma.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let serieId = null;
let serie = null;
let isInCollection = false;

export async function initAllSeriePage() {
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

  if (!serieId) {
    document.body.innerHTML = `<p class="text-center mt-10">${translate("invalidSeries")}</p>`;
    return;
  }

  // Primeiro tentar buscar pelo ID interno (caso a série já esteja na coleção)
  serie = await getSerieById(serieId);
  
  // Se não encontrar, tentar buscar pelo TMDB ID na coleção (usar apenas cache/localStorage)
  if (!serie) {
    const allSeries = await getAllSeries({ syncFromCloud: false });
    serie = allSeries.find(s => (s.tmdbId || s.id)?.toString() === serieId.toString());
  }
  
  // Se encontrou na coleção, marcar como já adicionado
  if (serie) {
    isInCollection = true;
  }
  
  // Se ainda não encontrar, buscar detalhes do TMDB (mas NÃO adicionar à coleção)
  if (!serie) {
    try {
      const tmdbData = await getSeriesDetails(serieId);
      if (tmdbData) {
        // Criar objeto temporário apenas para exibição (não salvar)
        serie = {
          id: serieId.toString(), // Usar TMDB ID como identificador temporário
          tmdbId: serieId.toString(),
          title: tmdbData.title,
          year: tmdbData.year,
          poster: tmdbData.poster,
          description: tmdbData.description || "",
          status: tmdbData.status || "On Display",
          genres: tmdbData.genres || [],
          rating: tmdbData.rating || 0,
        };
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

  // Renderizar informações da série
  renderSerieInfo();
  
  // Mostrar barra de progresso decorativa (sempre 0%)
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  if (progressBar && progressFill) {
    progressBar.style.display = "block";
    progressFill.style.width = "0%";
  }
  
  // Esconder temporadas
  const seasonsContainer = document.getElementById("seasons");
  if (seasonsContainer) {
    seasonsContainer.innerHTML = "";
  }
}

async function renderSerieInfo() {
  const container = document.getElementById("serieInfo");
  if (!container) return;

  // Detectar app mode
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    (window.innerWidth <= 768);

  if (isAppMode) {
    // Layout para app mode
    container.innerHTML = `
      <!-- Header fixo: Back + Título -->
      <div class="app-mode-header fixed top-0 left-0 right-0 h-20 bg-gray-900/95 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-4">
        <a href="javascript:history.back()" class="w-14 h-14 flex items-center justify-center text-white text-4xl">←</a>
        <h1 class="text-3xl font-bold text-center flex-1 px-4 truncate">${serie.title}</h1>
        <div class="w-14"></div> <!-- Spacer para centralizar título -->
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

        <!-- Botões: Add to Collection + Rating -->
        <div class="mb-6 flex items-center gap-4 flex-wrap">
          ${!isInCollection ? `
          <button id="addToCollectionBtn"
            class="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>+</span>
            <span>Add to Collection</span>
          </button>
          ` : `
          <span class="px-8 py-4 rounded-lg font-semibold bg-gray-700 text-gray-400 text-xl">
            ✓ In Collection
          </span>
          `}
          ${serie.rating
            ? `<span class="w-16 h-16 rounded-full bg-transparent border-2 border-green-900 flex items-center justify-center text-green-400 font-bold text-xl">
                ${serie.rating.toFixed(1)}
              </span>`
            : ""}
        </div>

        <!-- Botão: Trailer -->
        <div class="mb-6">
          <button id="trailerBtn"
            class="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>▶</span>
            <span>Trailer</span>
          </button>
        </div>
      </div>
    `;
  } else {
    // Layout original para desktop
    container.innerHTML = `
      <div class="flex flex-col md:flex-row gap-8">

        <img src="${serie.poster}"
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-48 h-72 object-cover rounded-lg shadow-lg ring-1 ring-white/10" />

        <div>
          <h1 class="text-3xl font-bold mb-2">
            ${serie.title}
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

          <div class="mt-4 flex flex-col gap-3">
            <div class="flex items-center gap-3">
              ${!isInCollection ? `
              <button id="addToCollectionBtn"
                class="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>+</span>
                <span>Add to Collection</span>
              </button>
              ` : `
              <span class="px-5 py-2 rounded-lg font-semibold bg-gray-700 text-gray-400">
                ✓ In Collection
              </span>
              `}
              ${serie.rating
                ? `<span class="w-12 h-12 rounded-full bg-transparent border border-green-900 flex items-center justify-center text-green-400 font-bold text-sm">
                    ${serie.rating.toFixed(1)}
                  </span>`
                : ""}
            </div>
            <div>
              <button id="trailerBtn"
                class="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>▶</span>
                <span>Trailer</span>
              </button>
            </div>
          </div>
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

  // Adicionar handler para o botão "Add to Collection"
  const addBtn = document.getElementById("addToCollectionBtn");
  if (addBtn) {
    addBtn.addEventListener("click", handleAddToCollection);
  }

  // Adicionar handler para o botão "Trailer"
  const trailerBtn = document.getElementById("trailerBtn");
  if (trailerBtn) {
    trailerBtn.addEventListener("click", handleTrailerClick);
  }
  
  // Adicionar handler para fechar o modal
  setupTrailerModal();

  // Logs para verificar tamanhos dos elementos
  setTimeout(() => {
    const container = document.querySelector('.app-mode-content');
    if (container) {
      const title = document.querySelector('.app-mode-header h1');
      const texts = container.querySelectorAll('p');
      const buttons = container.querySelectorAll('button');
      const poster = container.querySelector('img');
      
      console.log('📏 [SIZES] Element Sizes:', {
        title: title ? {
          fontSize: window.getComputedStyle(title).fontSize,
          marginTop: window.getComputedStyle(title).marginTop
        } : null,
        texts: Array.from(texts).slice(0, 3).map(p => ({
          fontSize: window.getComputedStyle(p).fontSize,
          lineHeight: window.getComputedStyle(p).lineHeight
        })),
        buttons: Array.from(buttons).slice(0, 3).map(btn => ({
          fontSize: window.getComputedStyle(btn).fontSize,
          padding: window.getComputedStyle(btn).padding,
          minHeight: window.getComputedStyle(btn).minHeight
        })),
        poster: poster ? {
          width: window.getComputedStyle(poster).width,
          height: window.getComputedStyle(poster).height
        } : null
      });
    }
  }, 200);
}

async function handleAddToCollection() {
  try {
    // Se a série ainda não está na coleção, adicionar
    if (!isInCollection && serie) {
      const newSerie = {
        id: `s${Date.now()}`,
        tmdbId: serie.tmdbId || serieId.toString(),
        title: serie.title,
        year: serie.year,
        poster: serie.poster,
        description: serie.description || "",
        status: serie.status || "On Display",
        genres: serie.genres || [],
        rating: serie.rating || 0,
      };
      
      await addSerie(newSerie);
      isInCollection = true;
      serie = newSerie;
      serieId = newSerie.id; // Atualizar para usar o ID interno
      
      toastSuccess("✔️ Series added to collection!");
      
      // Re-renderizar para mostrar o estado atualizado
      renderSerieInfo();
    }
  } catch (err) {
    console.error("Erro ao adicionar série à coleção:", err);
    alert("Erro ao adicionar série à coleção. Por favor, tente novamente.");
  }
}

async function handleTrailerClick() {
  const modal = document.getElementById("trailerModal");
  const iframe = document.getElementById("trailerIframe");
  
  if (!modal || !iframe) return;
  
  // Obter o TMDB ID da série (pode ser o serieId se for TMDB ID, ou serie.tmdbId)
  const tmdbId = serie.tmdbId || serieId.toString();
  
  try {
    // Buscar o trailer
    const trailerData = await getSeriesVideos(tmdbId);
    
    if (!trailerData || !trailerData.youtubeUrl) {
      alert("Trailer not available for this series.");
      return;
    }
    
    // Carregar o trailer no iframe com autoplay
    const autoplayUrl = trailerData.youtubeUrl.includes('?') 
      ? `${trailerData.youtubeUrl}&autoplay=1` 
      : `${trailerData.youtubeUrl}?autoplay=1`;
    iframe.src = autoplayUrl;
    
    // Mostrar o modal
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    
    // Bloquear scroll do body
    document.body.style.overflow = "hidden";
  } catch (err) {
    console.error("Erro ao buscar trailer:", err);
    alert("Error loading trailer. Please try again.");
  }
}

function setupTrailerModal() {
  const modal = document.getElementById("trailerModal");
  const closeBtn = document.getElementById("closeTrailerModal");
  const iframe = document.getElementById("trailerIframe");
  
  if (!modal || !closeBtn || !iframe) return;
  
  // Fechar ao clicar no botão X
  closeBtn.addEventListener("click", () => {
    closeTrailerModal();
  });
  
  // Fechar ao clicar fora do modal (no backdrop)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeTrailerModal();
    }
  });
  
  // Fechar com a tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeTrailerModal();
    }
  });
}

function closeTrailerModal() {
  const modal = document.getElementById("trailerModal");
  const iframe = document.getElementById("trailerIframe");
  
  if (!modal || !iframe) return;
  
  // Parar o vídeo removendo o src do iframe
  iframe.src = "";
  
  // Esconder o modal
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  
  // Restaurar scroll do body
  document.body.style.overflow = "";
}

