import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { getMovieById, getAllMovies, addMovie } from "../../modules/movies/moviesDataManager.js";
import { getMovieDetails, getMovieVideos } from "../../modules/tmdbApi.js";
import { addToFollowing, removeFromFollowing, getFollowingMovies } from "../../modules/movies/followingMovies.js";
import { toastSuccess } from "../../ui/toast.js";
import { t as translate } from "../../modules/idioma.js";

// Placeholder SVG para imagens que falham ao carregar
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let movieId = null;
let movie = null;
let isInCollection = false;
let isInFollowing = false;
let followingMovies = [];

// Verifica se o filme é "upcoming" (data de lançamento futura)
function isUpcomingMovie(movie) {
  if (!movie || !movie.release_date) return false;
  
  const releaseDate = new Date(movie.release_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Resetar horas para comparar apenas datas
  
  return releaseDate > today;
}

export async function initAllMoviePage() {
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

  // Carregar lista following
  followingMovies = await getFollowingMovies();

  const params = new URLSearchParams(window.location.search);
  movieId = params.get("id");

  if (!movieId) {
    document.body.innerHTML = `<p class="text-center mt-10">${translate("invalidMovie")}</p>`;
    return;
  }

  // Primeiro tentar buscar pelo ID interno (caso o filme já esteja na coleção)
  movie = await getMovieById(movieId);
  
  // Se não encontrar, tentar buscar pelo TMDB ID na coleção (usar cache)
  if (!movie) {
    const allMovies = await getAllMovies({ syncFromCloud: false });
    movie = allMovies.find(m => (m.tmdbId || m.id)?.toString() === movieId.toString());
  }
  
  // Se encontrou na coleção, marcar como já adicionado
  if (movie) {
    isInCollection = true;
  }
  
  // Se ainda não encontrar, buscar detalhes do TMDB (mas NÃO adicionar à coleção)
  if (!movie) {
    try {
      const tmdbData = await getMovieDetails(movieId);
      if (tmdbData) {
        // Criar objeto temporário apenas para exibição (não salvar)
        movie = {
          id: movieId.toString(), // Usar TMDB ID como identificador temporário
          tmdbId: movieId.toString(),
          title: tmdbData.title,
          year: tmdbData.year,
          poster: tmdbData.poster,
          posterPath: tmdbData.posterPath || null,
          backdropPath: tmdbData.backdropPath || null,
          overview: tmdbData.overview || "",
          rating: tmdbData.rating || 0,
          genres: tmdbData.genres || [],
          release_date: tmdbData.release_date || null,
        };
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
  
  // Verificar se o filme está na lista following (apenas se for upcoming)
  const movieIdToCheck = movie.tmdbId || movie.id || movieId.toString();
  isInFollowing = followingMovies.some(m => 
    (m.id === movieIdToCheck.toString()) || (m.tmdbId === movieIdToCheck.toString())
  );
  
  // Garantir que temos release_date se o filme veio da coleção
  if (movie && !movie.release_date && movie.year) {
    // Tentar construir uma data aproximada (1 de janeiro do ano)
    movie.release_date = `${movie.year}-01-01`;
  }

  // Renderizar informações do filme
  renderMovieInfo();
  
  // Mostrar barra de progresso decorativa (sempre 0%)
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  if (progressBar && progressFill) {
    progressBar.style.display = "block";
    progressFill.style.width = "0%";
  }
}

async function renderMovieInfo() {
  const container = document.getElementById("movieInfo");
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
        <h1 class="text-xl font-bold text-center flex-1 px-4 truncate">${movie.title}</h1>
        <div class="w-14"></div> <!-- Spacer para centralizar título -->
      </div>

      <!-- Conteúdo principal (com padding-top para compensar header) -->
      <div class="app-mode-content pt-24 pb-8">
        <!-- Poster horizontal -->
        <div class="mb-6">
          <img src="${movie.poster}"
               data-placeholder="${PLACEHOLDER_IMAGE}"
               class="w-full object-cover rounded-lg shadow-lg" />
        </div>

        <!-- Sinopse -->
        <p class="text-gray-400 mb-6 text-xl leading-relaxed">
          ${movie.overview || movie.description || "No description available."}
        </p>

        <!-- Info: Year, Genre -->
        <div class="mb-6 text-xl text-gray-400 space-y-2">
          <div><span class="font-semibold text-white">Year:</span> ${movie.year}</div>
          ${movie.genres && movie.genres.length > 0
            ? `<div><span class="font-semibold text-white">Genre:</span> ${movie.genres.join(", ")}</div>`
            : ""}
        </div>

        <!-- Botões: Add to Collection + Rating -->
        <div class="mb-6 flex items-center gap-4 flex-wrap">
          ${!isInCollection ? `
          <button id="addToCollectionBtn"
            class="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>+</span>
            <span>Add to Collection</span>
          </button>
          ` : `
          <span class="px-8 py-4 rounded-lg font-semibold bg-gray-700 text-gray-400 text-xl">
            ✓ In Collection
          </span>
          `}
          ${movie.rating
            ? `<span class="w-16 h-16 rounded-full bg-transparent border-2 border-blue-900 flex items-center justify-center text-blue-400 font-bold text-xl">
                ${movie.rating.toFixed(1)}
              </span>`
            : ""}
        </div>

        <!-- Botões: Trailer + Follow (se upcoming) -->
        <div class="mb-6 flex items-center gap-4 flex-wrap">
          <button id="trailerBtn"
            class="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>▶</span>
            <span>Trailer</span>
          </button>
          ${isUpcomingMovie(movie) ? (
            !isInFollowing ? `
          <button id="followBtn"
            class="bg-yellow-600 hover:bg-yellow-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>⭐</span>
            <span>Follow</span>
          </button>
          ` : `
          <button id="unfollowBtn"
            class="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-semibold text-xl flex items-center gap-2">
            <span>✓</span>
            <span>Following</span>
          </button>
          `
          ) : ''}
        </div>
      </div>
    `;
  } else {
    // Layout original para desktop
    container.innerHTML = `
      <div class="flex flex-col md:flex-row gap-8">

        <img src="${movie.poster}"
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-48 h-72 object-cover rounded-lg shadow-lg ring-1 ring-white/10" />

        <div>
          <h1 class="text-3xl font-bold mb-2">
            ${movie.title}
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

          <div class="mt-4 flex flex-col gap-3">
            <div class="flex items-center gap-3">
              ${!isInCollection ? `
              <button id="addToCollectionBtn"
                class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>+</span>
                <span>Add to Collection</span>
              </button>
              ` : `
              <span class="px-5 py-2 rounded-lg font-semibold bg-gray-700 text-gray-400">
                ✓ In Collection
              </span>
              `}
              ${movie.rating
                ? `<span class="w-12 h-12 rounded-full bg-transparent border border-blue-900 flex items-center justify-center text-blue-400 font-bold text-sm">
                    ${movie.rating.toFixed(1)}
                  </span>`
                : ""}
            </div>
            <div class="flex items-center gap-3">
              <button id="trailerBtn"
                class="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>▶</span>
                <span>Trailer</span>
              </button>
              ${isUpcomingMovie(movie) ? (
                !isInFollowing ? `
              <button id="followBtn"
                class="bg-yellow-600 hover:bg-yellow-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>⭐</span>
                <span>Follow</span>
              </button>
              ` : `
              <button id="unfollowBtn"
                class="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>Following</span>
              </button>
              `
              ) : ''}
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

  // Adicionar handler para o botão "Follow"
  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    followBtn.addEventListener("click", handleFollowClick);
  }

  // Adicionar handler para o botão "Unfollow"
  const unfollowBtn = document.getElementById("unfollowBtn");
  if (unfollowBtn) {
    unfollowBtn.addEventListener("click", handleUnfollowClick);
  }
  
  // Adicionar handler para fechar o modal
  setupTrailerModal();
}

async function handleAddToCollection() {
  try {
    // Se o filme ainda não está na coleção, adicionar
    if (!isInCollection && movie) {
      const newMovie = {
        id: movie.tmdbId || movieId.toString(),
        tmdbId: movie.tmdbId || movieId.toString(),
        title: movie.title,
        year: movie.year,
        poster: movie.poster,
        posterPath: movie.posterPath || null,
        backdropPath: movie.backdropPath || null,
        overview: movie.overview || "",
        rating: movie.rating || 0,
        genres: movie.genres || [],
      };
      
      await addMovie(newMovie);
      isInCollection = true;
      movie = newMovie;
      
      toastSuccess("✔️ Movie added to collection!");
      
      // Re-renderizar para mostrar o estado atualizado
      renderMovieInfo();
    }
  } catch (err) {
    console.error("Erro ao adicionar filme à coleção:", err);
    alert("Erro ao adicionar filme à coleção. Por favor, tente novamente.");
  }
}

async function handleTrailerClick() {
  const modal = document.getElementById("trailerModal");
  const iframe = document.getElementById("trailerIframe");
  
  if (!modal || !iframe) return;
  
  // Obter o TMDB ID do filme (pode ser o movieId se for TMDB ID, ou movie.tmdbId)
  const tmdbId = movie.tmdbId || movieId.toString();
  
  try {
    // Buscar o trailer
    const trailerData = await getMovieVideos(tmdbId);
    
    if (!trailerData || !trailerData.youtubeUrl) {
      alert("Trailer not available for this movie.");
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

async function handleFollowClick() {
  try {
    if (!movie) return;
    
    const movieData = {
      id: movie.tmdbId || movie.id || movieId.toString(),
      tmdbId: movie.tmdbId || movie.id || movieId.toString(),
      title: movie.title,
      poster: movie.poster,
      posterPath: movie.posterPath || null,
      backdropPath: movie.backdropPath || null,
      release_date: movie.release_date || null,
      year: movie.year
    };
    
    await addToFollowing(movieData);
    isInFollowing = true;
    followingMovies = await getFollowingMovies();
    
    toastSuccess("Added to following!");
    
    // Re-renderizar para mostrar o estado atualizado
    renderMovieInfo();
  } catch (err) {
    console.error("Erro ao adicionar à lista following:", err);
    alert("Error adding to following list. Please try again.");
  }
}

async function handleUnfollowClick() {
  try {
    const movieIdToRemove = movie.tmdbId || movie.id || movieId.toString();
    
    await removeFromFollowing(movieIdToRemove);
    isInFollowing = false;
    followingMovies = await getFollowingMovies();
    
    toastSuccess("Removed from following");
    
    // Re-renderizar para mostrar o estado atualizado
    renderMovieInfo();
  } catch (err) {
    console.error("Erro ao remover da lista following:", err);
    alert("Error removing from following list. Please try again.");
  }
}

