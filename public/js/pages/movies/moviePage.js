import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { getMovieById, getAllMovies } from "../../modules/movies/moviesDataManager.js";
import { syncMovieFromTMDB } from "../../modules/movies/moviesSync.js";
import { getMovieProgress, toggleMovieWatched } from "../../modules/movies/moviesProgress.js";
import { toastSuccess } from "../../ui/toast.js";
import { t as translate } from "../../modules/idioma.js";
import { addMovieToFavorites, removeMovieFromFavorites, isMovieFavorite } from "../../modules/movies/moviesFavorites.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let movieId = null;
let movie = null;
let fromAllMovies = false;
let isFavorite = false;
let cachedProgress = null; // Cache do progresso para evitar leituras duplicadas
let netflixProvider = null;

export async function initMoviePage() {
  renderNavbar();
  renderFooter();

  const params = new URLSearchParams(window.location.search);
  movieId = params.get("id");
  fromAllMovies = params.get("from") === "allmovies";

  if (!movieId) {
    document.body.innerHTML = `<p class="text-center mt-10">${translate("invalidMovie")}</p>`;
    return;
  }

  // Primeiro tentar buscar pelo ID interno
  movie = await getMovieById(movieId);
  
  // Se não encontrar, tentar buscar pelo TMDB ID usando apenas cache
  if (!movie) {
    const allMovies = await getAllMovies({ syncFromCloud: false });
    movie = allMovies.find(m => (m.tmdbId || m.id)?.toString() === movieId.toString());
  }
  
  // Se ainda não encontrar, pode ser um TMDB ID de um filme que não está na coleção
  // Tentar buscar detalhes do TMDB e adicionar automaticamente
  if (!movie) {
    try {
      const { getMovieDetails } = await import("../../modules/tmdbApi.js");
      const { addMovie } = await import("../../modules/movies/moviesDataManager.js");
      
        const tmdbData = await getMovieDetails(movieId);
      if (tmdbData) {
        // Adicionar o filme à coleção (formato igual ao addMoviesPage.js)
        const newMovie = {
          id: `m${Date.now()}`,
          tmdbId: movieId.toString(), // Guardar explicitamente o ID do TMDB
          title: tmdbData.title,
          year: tmdbData.year,
          poster: tmdbData.poster,
          overview: tmdbData.overview || "",
          rating: tmdbData.rating || 0,
          genres: tmdbData.genres || [],
        };
        
        await addMovie(newMovie);
        movie = newMovie;
        movieId = newMovie.id; // Atualizar para usar o ID interno
      } else {
        document.body.innerHTML = `<p class="text-center mt-10">${translate("movieNotFound")}</p>`;
        return;
      }
    } catch (err) {
      console.error("Erro ao buscar filme do TMDB:", err);
      document.body.innerHTML = `<p class="text-center mt-10">${translate("movieNotFound")}</p>`;
      return;
    }
  }

  // Verificar se é favorito
  try {
    const favKey = movie.tmdbId || movieId;
    isFavorite = await isMovieFavorite(favKey);
  } catch (err) {
    console.warn("Erro ao verificar favorito do filme:", err);
    isFavorite = false;
  }

  // Renderizar primeiro (UI instantânea - não espera pelo TMDB)
  renderMovieInfo();
  
  // Mostrar barra de progresso decorativa se vier de allmovies
  if (fromAllMovies) {
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    if (progressBar && progressFill) {
      progressBar.style.display = "block";
      // Sempre 0% (apenas decorativo)
      progressFill.style.width = "0%";
    }
  }
  
  // Sincronizar com TMDB em background (não bloquear a UI)
  syncMovieFromTMDB(movieId).then(async () => {
    const updatedMovie = await getMovieById(movieId);
    if (updatedMovie) {
      movie = updatedMovie;
      renderMovieInfo(); // Atualizar UI silenciosamente se houver mudanças
    }
  }).catch(err => {
    console.warn("Could not sync movie from TMDB:", err);
    // Falha silenciosa - UI já está renderizada com dados locais
  });
}

async function renderMovieInfo() {
  const container = document.getElementById("movieInfo");
  if (!container) return;

  // Usar cache se já foi carregado, senão carregar do Firestore
  if (!cachedProgress) {
    cachedProgress = await getMovieProgress(movieId);
  }
  const isWatched = cachedProgress.watched || false;

  // Buscar watch providers (apenas se o proxy estiver disponível)
  if (movie?.tmdbId) {
    try {
      const { getMovieWatchProviders } = await import("../../modules/tmdbApi.js");
      netflixProvider = await getMovieWatchProviders(movie.tmdbId, movie.title);
    } catch (err) {
      // Se o proxy não estiver disponível (ex: desenvolvimento local), não mostrar erro
      if (err.message?.includes("405") || err.message?.includes("Method not allowed")) {
        console.info("ℹ️ TMDB proxy não disponível localmente. O botão Netflix aparecerá quando deployado no Vercel.");
      } else {
        console.warn("Erro ao buscar watch providers:", err);
      }
      netflixProvider = { hasNetflix: false };
    }
  }

    container.innerHTML = `
      <div class="flex flex-col md:flex-row gap-8">

        <img src="${movie.poster}"
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-48 h-72 object-cover rounded-lg shadow-lg ring-1 ring-white/10" />

        <div>
          <h1 class="text-3xl font-bold mb-2 flex items-center gap-3">
            ${movie.title}
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
            ${movie.overview || movie.description || "No description available."}
          </p>

          <div class="mt-4 text-sm text-gray-400 flex items-center gap-3">
            <span><span class="font-semibold text-white">• Year:</span> ${movie.year}</span>
            ${movie.genres && movie.genres.length > 0
              ? `<span><span class="font-semibold text-white">• Genre:</span> ${movie.genres.join(", ")}</span>`
              : ""}
          </div>

          <div class="mt-4 flex items-center gap-3 flex-wrap">
            ${!fromAllMovies ? `
            <button id="toggleWatchedBtn"
              class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-semibold">
              ${isWatched ? `❌ ${translate("unmark")}` : `✔️ ${translate("markAsViewed")}`}
            </button>
            ` : ""}
            ${netflixProvider?.hasNetflix ? `
            <a href="${netflixProvider.netflixUrl}" target="_blank" rel="noopener noreferrer"
               class="bg-black hover:bg-gray-900 p-3 rounded-lg flex items-center justify-center"
               title="Watch on Netflix">
              <img src="./assets/netflix-logo.png" alt="Netflix" class="w-7 h-7 object-contain" />
            </a>
            ` : ""}
            ${movie.rating
              ? `<span class="w-12 h-12 rounded-full bg-transparent border border-blue-900 flex items-center justify-center text-blue-400 font-bold text-sm">
                  ${movie.rating.toFixed(1)}
                </span>`
              : ""}
          </div>
        </div>

      </div>
    `;

    // Adicionar handler de erro para imagem após inserir HTML
    const img = container.querySelector('img[data-placeholder]');
    if (img) {
      img.onerror = function() {
        this.onerror = null;
        this.src = this.getAttribute('data-placeholder');
      };
    }

    const toggleBtn = document.getElementById("toggleWatchedBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", toggleWatched);
    }

    const favoriteBtn = document.getElementById("favoriteToggleBtn");
    if (favoriteBtn) {
      favoriteBtn.addEventListener("click", toggleFavorite);
    }
}

async function toggleWatched() {
  const isWatched = await toggleMovieWatched(movieId);
  
  // Atualizar cache do progresso após mudança
  cachedProgress = await getMovieProgress(movieId);
  
  toastSuccess(
    isWatched
      ? `✔️ ${translate("markAsViewed")}`
      : `❌ ${translate("unmark")}`
  );
  renderMovieInfo();
}

async function toggleFavorite() {
  if (!movie) return;

  try {
    const favKey = movie.tmdbId || movieId;

    if (isFavorite) {
      await removeMovieFromFavorites(favKey);
      isFavorite = false;
      toastSuccess(translate("removedFromFavorites") || "Removed from favorites");
    } else {
      await addMovieToFavorites(movie);
      isFavorite = true;
      toastSuccess(translate("addedToFavorites") || "Added to favorites");
    }

    // Re-renderizar header para atualizar ícone
    renderMovieInfo();
  } catch (err) {
    console.error("Erro ao alternar favorito do filme:", err);
    alert("Error updating favorites. Please try again.");
  }
}

