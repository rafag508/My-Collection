import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { renderHero } from "../ui/hero.js";
import { checkMovieReleases, getFollowingMovies } from "../modules/movies/followingMovies.js";
import { getFollowingSeries, checkSeriesReleases } from "../modules/series/followingSeries.js";
import { TMDB_IMAGE_BASE, getMovieDetails, getSeriesDetails } from "../modules/tmdbApi.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";



function parseDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

async function renderUpcomingHero() {
  const container = document.getElementById("upcoming");
  if (!container) return;

  try {
    const [followingMovies, followingSeries] = await Promise.all([
      getFollowingMovies(),
      getFollowingSeries(),
    ]);

    if (
      (!followingMovies || followingMovies.length === 0) &&
      (!followingSeries || followingSeries.length === 0)
    ) {
      container.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 text-sm text-gray-400 pb-8">
          Ainda não tens filmes ou séries na tua lista <strong>Following</strong>.
        </div>
      `;
      return;
    }

    // ---------- FILMES ----------
    const moviesWithDate = (followingMovies || []).map((m) => {
      const dt = parseDate(m.release_date);
      return { ...m, _date: dt, _type: "movie" };
    });

    // ---------- SÉRIES: buscar próximo episódio a estrear ----------
    const seriesWithDate = await Promise.all(
      (followingSeries || []).map(async (s) => {
        try {
          const details = await getSeriesDetails(s.tmdbId || s.id);
          const ne = details?.nextEpisode || null;
          const dt = ne?.air_date ? parseDate(ne.air_date) : null;

          return {
            ...s,
            _type: "series",
            _date: dt,
            nextEpisode: ne,
            posterPath: details?.posterPath || s.posterPath || null,
            backdropPath: details?.backdropPath || s.backdropPath || null,
          };
        } catch (err) {
          console.warn("Home: erro ao buscar próximo episódio da série:", err);
          return { ...s, _type: "series", _date: null, nextEpisode: null };
        }
      })
    );

    // ---------- JUNTAR + ORDENAR POR DATA ----------
    const allItems = [...moviesWithDate, ...seriesWithDate];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingItems = allItems
      .filter((item) => item._date && item._date >= today)
      .sort((a, b) => a._date - b._date);

    if (upcomingItems.length === 0) {
      container.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 text-sm text-gray-400 pb-8">
          Não há próximos lançamentos nas tuas listas de Following.
        </div>
      `;
      return;
    }

    let currentIndex = 0;
    let autoplayId = null;

    function buildBgUrl(item) {
      if (item.backdropPath) {
        return `${TMDB_IMAGE_BASE}/w1280${item.backdropPath}`;
      }
      if (item.posterPath) {
        return `${TMDB_IMAGE_BASE}/w780${item.posterPath}`;
      }
      if (item.poster) {
        return item.poster;
      }
      return "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop";
    }

    function formatLongDate(dt) {
      if (!dt) return "";
      const meses = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      return `${dt.getDate()} ${meses[dt.getMonth()]}`;
    }

    function formatEpisode(nextEpisode) {
      if (!nextEpisode || !nextEpisode.seasonNumber || !nextEpisode.episodeNumber) return "";
      const s = String(nextEpisode.seasonNumber).padStart(2, "0");
      const e = String(nextEpisode.episodeNumber).padStart(2, "0");
      return `S${s} | E${e}`;
    }

    function renderSlide(index) {
      const item = upcomingItems[index];
      if (!item) return;

      // Atualizar índice atual
      currentIndex = index;

      const bgUrl = buildBgUrl(item);
      const href =
        item._type === "movie"
          ? `movie.html?id=${encodeURIComponent((item.tmdbId || item.id).toString())}`
          : `serie.html?id=${encodeURIComponent((item.tmdbId || item.id).toString())}`;

      const longDate = formatLongDate(item._date);
      const epCode = item._type === "series" ? formatEpisode(item.nextEpisode) : "";

      // Pagination dots (um por item, o atual em destaque)
      const dotsHtml = upcomingItems
        .map((_, i) => {
          const isActive = i === index;
          return `<span class="w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-white/40"}"></span>`;
        })
        .join("");

      container.innerHTML = `
        <div
          class="w-full relative overflow-hidden bg-gradient-to-r from-gray-900 via-gray-900/80 to-black ring-1 ring-white/10 aspect-[16/9] max-h-[700px]"
        >
          <div class="absolute inset-0 opacity-70 lg:opacity-100">
            <div
              class="w-full h-full bg-cover bg-center"
              style="background-image:url('${bgUrl}');"
            ></div>
            <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent"></div>
          </div>

          <div class="relative z-10 h-full flex flex-col justify-center max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-14 space-y-4">
            <h2 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
              ${item.title}
            </h2>

            ${
              longDate || epCode
                ? `<p class="hero-date-episode text-lg sm:text-xl lg:text-2xl font-semibold text-white">
                    ${longDate ? longDate : ""}${longDate && epCode ? " • " : ""}${epCode ? epCode : ""}
                  </p>`
                : ""
            }

            <div class="flex flex-wrap items-center gap-3 pt-4">
              <button
                data-hero-more
                class="inline-flex items-center gap-2 rounded-full bg-transparent border border-white/50 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors"
              >
                Ver detalhes
              </button>
            </div>
          </div>

          <!-- Controlo do carrossel - setas ao meio -->
          <div class="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 lg:px-6 text-sm text-gray-300 pointer-events-none">
            <button data-prev
              class="pointer-events-auto rounded-full bg-black/60 hover:bg-black/80 px-3 py-1 border border-white/30">
              ‹
            </button>
            <button data-next
              class="pointer-events-auto rounded-full bg-black/60 hover:bg-black/80 px-3 py-1 border border-white/30">
              ›
            </button>
          </div>

          <!-- Paginação por pontos no fundo do hero -->
          <div class="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
            <div class="flex gap-1">
              ${dotsHtml}
            </div>
          </div>
        </div>
      `;

      const moreBtn = container.querySelector("[data-hero-more]");
      if (moreBtn) {
        moreBtn.addEventListener("click", () => {
          window.location.href = href;
        });
      }

      const prevBtn = container.querySelector("[data-prev]");
      const nextBtn = container.querySelector("[data-next]");

      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          const prevIndex = (currentIndex - 1 + upcomingItems.length) % upcomingItems.length;
          renderSlide(prevIndex);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          const nextIndex = (currentIndex + 1) % upcomingItems.length;
          renderSlide(nextIndex);
        });
      }

      // Detecção de swipe para mobile/app
      let touchStartX = 0;
      let touchEndX = 0;
      const slideElement = container.querySelector("div");

      function handleSwipe() {
        const swipeThreshold = 50; // Mínimo de pixels para considerar swipe
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
          if (diff > 0) {
            // Swipe para a esquerda = próximo slide
            const nextIndex = (currentIndex + 1) % upcomingItems.length;
            renderSlide(nextIndex);
            // Reset autoplay
            if (autoplayId) clearInterval(autoplayId);
            autoplayId = setInterval(() => {
              const nextIndex = (currentIndex + 1) % upcomingItems.length;
              renderSlide(nextIndex);
            }, 8000);
          } else {
            // Swipe para a direita = slide anterior
            const prevIndex = (currentIndex - 1 + upcomingItems.length) % upcomingItems.length;
            renderSlide(prevIndex);
            // Reset autoplay
            if (autoplayId) clearInterval(autoplayId);
            autoplayId = setInterval(() => {
              const nextIndex = (currentIndex + 1) % upcomingItems.length;
              renderSlide(nextIndex);
            }, 8000);
          }
        }
      }

      if (slideElement) {
        slideElement.addEventListener("touchstart", (e) => {
          touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        slideElement.addEventListener("touchend", (e) => {
          touchEndX = e.changedTouches[0].screenX;
          handleSwipe();
        }, { passive: true });
      }

      // --- AUTOPLAY: ~8 segundos por slide ---
      if (autoplayId) {
        clearInterval(autoplayId);
      }
      autoplayId = setInterval(() => {
        const nextIndex = (currentIndex + 1) % upcomingItems.length;
        renderSlide(nextIndex);
      }, 8000);
    }

    // Primeiro slide
    renderSlide(currentIndex);
  } catch (err) {
    console.warn("Home: renderUpcomingHero failed:", err);
  }
}

export function initIndexPage() {
  renderNavbar();
  renderHero();

  checkMovieReleases().catch(err =>
    console.warn("Home: checkMovieReleases failed:", err)
  );

  checkSeriesReleases().catch(err =>
    console.warn("Home: checkSeriesReleases failed:", err)
  );

  renderUpcomingHero();

  setupHomeSearch();

  renderFooter();
}

function setupHomeSearch() {
  const searchInput = document.getElementById("search");
  if (!searchInput) return;

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = e.target.value.trim();
      if (query) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    }
  });
}

