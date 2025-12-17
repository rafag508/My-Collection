// === notificationsPage.js ===
import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { getNotifications, clearNotifications, markAllAsRead } from "../modules/notifications.js";
import { storageService } from "../modules/storageService.js";
import { getSerieById } from "../modules/series/seriesDataManager.js";
import { getMovieById } from "../modules/movies/moviesDataManager.js";
import { PaginationManager } from "../modules/shared/pagination.js";

// Paginação
const PAGE_SIZE = 5;
let allNotifications = [];
let pagination = null; // Será inicializado no initNotificationsPage

export async function initNotificationsPage() {
  renderNavbar();
  renderFooter();

  // Detecta refresh (F5) - método compatível com browsers modernos
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const isRefresh = navigationEntry?.type === 'reload' || (performance.navigation && performance.navigation.type === 1);
  
  // Se for refresh, limpar flag de sincronização para permitir nova sync
  if (isRefresh) {
    sessionStorage.removeItem("hasSyncedNotificationsFromFirestoreOnce");
  }

  const clearBtn = document.getElementById("clearNotificationsBtn");
  const listEl = document.getElementById("notificationsList");

  if (!listEl) return;

  // 1️⃣ Carregar cache local imediamente
  const localNotifications = await storageService.get("notifications", []);
  allNotifications = Array.isArray(localNotifications) ? localNotifications : [];

  // ✅ INICIALIZAR PAGINAÇÃO
  pagination = new PaginationManager({
    pageSize: PAGE_SIZE,
    initialPage: 1,
    buttonPrefix: 'notifications',
    activeColor: 'bg-blue-600',
    updateURL: () => {}, // Notifications não usa URL para paginação
    getTotalItems: () => allNotifications.length,
    onPageChange: async () => {
      await renderNotifications(listEl, allNotifications);
      if (pagination) {
        pagination.render("notificationsPaginationTop", "notificationsPagination");
      }
      // Scroll para o topo quando mudar de página
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  pagination.ensureCurrentPageInRange();
  await renderNotifications(listEl, allNotifications);
  pagination.render("notificationsPaginationTop", "notificationsPagination");

  // 1.5️⃣ Marcar como lidas ao abrir
  const updatedNotifications = await markAllAsRead();
  if (updatedNotifications && updatedNotifications.length > 0) {
    allNotifications = updatedNotifications;
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    await renderNotifications(listEl, allNotifications);
    if (pagination) {
      pagination.render("notificationsPaginationTop", "notificationsPagination");
    }
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      await clearNotifications();
      allNotifications = [];
      if (pagination) {
        pagination.firstPage();
      }
      await loadAndRender();
    });
  }

  // 2️⃣ Sync background
  getNotifications()
    .then(async (cloudNotifs) => {
      if (cloudNotifs && Array.isArray(cloudNotifs)) {
        allNotifications = cloudNotifs;
        if (pagination) {
          pagination.ensureCurrentPageInRange();
        }
        await renderNotifications(listEl, allNotifications);
        if (pagination) {
          pagination.render("notificationsPaginationTop", "notificationsPagination");
        }
      }
    })
    .catch((err) => console.warn("notificationsPage: sync failed:", err));

  // 3️⃣ Evento de sync
  document.addEventListener("notificationsSynced", async (e) => {
    if (e.detail && e.detail.data) {
      allNotifications = e.detail.data;
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      await renderNotifications(listEl, allNotifications);
      if (pagination) {
        pagination.render("notificationsPaginationTop", "notificationsPagination");
      }
    }
  });

  // 4️⃣ Evento de atualização
  document.addEventListener("notificationsUpdated", async (e) => {
    if (e.detail && e.detail.data) {
      allNotifications = e.detail.data;
      if (pagination) {
        pagination.ensureCurrentPageInRange();
      }
      await renderNotifications(listEl, allNotifications);
      if (pagination) {
        pagination.render("notificationsPaginationTop", "notificationsPagination");
      }
    }
  });

  async function loadAndRender() {
    const notifs = await getNotifications();
    allNotifications = Array.isArray(notifs) ? notifs : [];
    if (pagination) {
      pagination.ensureCurrentPageInRange();
    }
    await renderNotifications(listEl, allNotifications);
    if (pagination) {
      pagination.render("notificationsPaginationTop", "notificationsPagination");
    }
  }
}

async function renderNotifications(container, notifs) {
  if (!notifs || notifs.length === 0) {
    container.innerHTML = `
      <p class="text-gray-400 text-sm">
        No notifications yet. When new episodes are added to your series, they will appear here.
      </p>`;
    return;
  }

  const sorted = [...notifs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Usar PaginationManager para obter items da página
  const pageItems = pagination ? pagination.getPageItems(sorted) : sorted;

  const cardsHtml = await Promise.all(
    pageItems.map(async (n) => {
      const date = n.timestamp ? new Date(n.timestamp).toLocaleDateString("pt-PT") : "";

      // Se for notificação de filme (movie_release), usar layout próprio
      if (n.type === "movie_release") {
        const FALLBACK_POSTER = "./assets/icons/mc-icon-blue.svg";
        let posterUrl =
          n.moviePoster ||
          movie?.poster ||
          FALLBACK_POSTER;

        if (n.movieId && !n.moviePoster) {
          try {
            movie = await getMovieById(n.movieId);
            posterUrl = movie?.poster || posterUrl;
          } catch (err) {
            console.warn("Could not fetch movie:", err);
          }
        }

        const movieTitle = n.movieTitle || movie?.title || "Unknown movie";

        return `
          <article class="bg-gray-900 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-200">
            <div class="flex flex-col md:flex-row">
              <!-- Poster: ocupa toda a zona cinzenta -->
              <div class="w-full md:w-1/4 bg-gray-800/50 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                <img 
                  src="${posterUrl}" 
                  alt="${movieTitle}" 
                  class="w-full h-auto max-h-[320px] rounded-lg shadow-lg object-cover"
                  onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
                />
              </div>

              <!-- Conteúdo: ~3/4 do card -->
              <div class="w-full md:w-3/4 p-4 flex flex-col justify-start">
                <h2 class="font-bold text-2xl text-white mb-2 line-clamp-2">${movieTitle}</h2>
                <p class="text-base text-gray-400">${date || ""}</p>
              </div>
            </div>
          </article>`;
      }

      // Caso contrário, tratar como notificação de série
      // 1) Estreia de episódio hoje (Home: checkSeriesReleases)
      if (n.type === "series_episode_release") {
        let serie = null;
        let poster = null;
        if (n.serieId) {
          try {
            serie = await getSerieById(n.serieId);
            poster = serie?.poster || null;
          } catch (err) {
            console.warn("Could not fetch serie:", err);
          }
        }

        const FALLBACK_POSTER = "./assets/icons/mc-icon-green.svg";
        const posterUrl = n.seriePoster || poster || FALLBACK_POSTER;
        const serieName = n.serieName || serie?.title || "Unknown series";

        const seasonNum = n.season != null ? n.season : null;
        const episodeNum = n.episode != null ? n.episode : null;

        // Detetar idioma atual (definido pelo módulo de idioma)
        const htmlLang = (document.documentElement && document.documentElement.lang) || "en";
        const isPT = htmlLang.startsWith("pt");

        // Palavra "Season" traduzida conforme idioma
        const seasonWord = isPT ? "Temporada" : "Season";
        const seasonLabel = seasonNum != null ? `${seasonWord} ${seasonNum}` : `${seasonWord} ?`;

        const episodeTitle = n.episodeName || (episodeNum != null ? `Episode ${episodeNum}` : "Episode");
        const episodeLine =
          episodeNum != null ? `Ep.${episodeNum} - ${episodeTitle}` : episodeTitle;

        return `
          <article class="bg-gray-900 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-200">
            <div class="flex flex-col md:flex-row">
              <!-- Poster: ocupa toda a zona cinzenta -->
              <div class="w-full md:w-1/4 bg-gray-800/50 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                <img 
                  src="${posterUrl}" 
                  alt="${serieName}" 
                  class="w-full h-auto max-h-[320px] rounded-lg shadow-lg object-cover"
                  onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
                />
              </div>

              <!-- Conteúdo: ~3/4 do card -->
              <div class="w-full md:w-3/4 p-4 flex flex-col justify-start">
                <div class="flex items-baseline justify-between gap-4 mb-3">
                  <h2 class="font-bold text-2xl text-white line-clamp-2">${serieName}</h2>
                  <p class="text-base text-gray-400 whitespace-nowrap">${date || ""}</p>
                </div>
                <p class="text-lg text-gray-200 mb-1">${seasonLabel}</p>
                <p class="text-base text-gray-500">${episodeLine}</p>
              </div>
            </div>
          </article>`;
      }

      // Caso contrário, tratar como notificação de série (layout antigo)
      const episodes = Array.isArray(n.addedEpisodes) ? n.addedEpisodes : [];
      const episodeCount = episodes.length;

      let serie = null;
      let poster = null;
      if (n.serieId) {
        try {
          serie = await getSerieById(n.serieId);
          poster = serie?.poster || null;
        } catch (err) {
          console.warn("Could not fetch serie:", err);
        }
      }

      const bySeason = {};
      episodes.forEach((ep) => {
        const season = ep.season ?? "?";
        if (!bySeason[season]) bySeason[season] = [];
        bySeason[season].push(ep);
      });

      const seasonsHtml = Object.entries(bySeason)
        .map(([season, eps]) => {
          // Dividir episódios em duas colunas
          const totalEps = eps.length;
          const midPoint = Math.ceil(totalEps / 2);
          const firstColumn = eps.slice(0, midPoint);
          const secondColumn = eps.slice(midPoint);
          
          // Função para gerar HTML de uma coluna de episódios
          const generateEpList = (episodes) => {
            return episodes
              .map((ep) => {
                const num = ep.index ?? "?";
                const title = ep.title || `Ep. ${num}`;
                
                // Se o título já contém "Ep.", usar apenas o título formatado
                // Caso contrário, formatar como "Ep. X - Título"
                let displayText = title;
                if (!title.startsWith("Ep.")) {
                  displayText = `Ep. ${num} - ${title}`;
                }
                
                // Separar número do episódio e título
                const parts = displayText.split(" - ");
                const epNumber = parts[0];
                const epTitle = parts.slice(1).join(" - ");
                
                return `
                  <li class="flex items-center justify-between text-sm py-1 border-b border-gray-800/50 last:border-0">
                    <span class="flex-1">
                      <span class="text-blue-400 font-medium">${epNumber}</span>
                      ${epTitle ? `<span class="text-gray-300 ml-2">${epTitle}</span>` : ""}
                    </span>
                  </li>`;
              })
              .join("");
          };

          const firstColHtml = generateEpList(firstColumn);
          const secondColHtml = generateEpList(secondColumn);

          return `
            <div class="mt-3">
              <p class="text-sm font-semibold text-blue-300 mb-2">Season ${season}</p>
              <div class="grid grid-cols-2 gap-4">
                <ul class="space-y-0">
                  ${firstColHtml}
                </ul>
                <ul class="space-y-0">
                  ${secondColHtml}
                </ul>
              </div>
            </div>`;
        })
        .join("");

      // Usar poster da série, ou um ícone genérico se não existir
      const FALLBACK_POSTER = "./assets/icons/mc-icon-green.svg";
      const posterUrl = poster || FALLBACK_POSTER;
      const serieName = n.serieName || serie?.title || "Unknown series";

      return `
        <article class="bg-gray-900 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all duration-200">
          <div class="flex flex-col md:flex-row">
            <div class="w-full md:w-1/4 bg-gray-800/50 p-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-white/10">
              <img 
                src="${posterUrl}" 
                alt="${serieName}" 
                class="w-full max-w-[150px] h-auto rounded-lg shadow-lg mb-3 object-cover"
                onerror="this.onerror=null;this.src='${FALLBACK_POSTER}'"
              />
              <h2 class="font-bold text-lg text-white mb-1 line-clamp-2">${serieName}</h2>
              <p class="text-xs text-gray-400 mb-2">${episodeCount} ${episodeCount === 1 ? "episode" : "episodes"} added</p>
              <p class="text-xs text-gray-500">${date || ""}</p>
            </div>

            <div class="w-full md:w-3/4 p-4">
              ${seasonsHtml || `<p class="text-gray-400 text-sm">No episodes listed.</p>`}
            </div>
          </div>
        </article>`;
    })
  );

  container.innerHTML = cardsHtml.join("");
}
