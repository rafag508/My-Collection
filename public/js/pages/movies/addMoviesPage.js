// src/pages/addMoviesPage.js

import { searchMovies, getMovieDetails } from "../../modules/tmdbApi.js";
import { addMovie, getAllMovies } from "../../modules/movies/moviesDataManager.js";
import { toastSuccess, toastError } from "../../ui/toast.js";
import { t as translate } from "../../modules/idioma.js";

let modal, searchInput, resultsContainer, closeBtn, btnAdd;

export function setupAddMoviesModal() {
  modal = document.getElementById("addMoviesModal");
  if (!modal) return;

  searchInput = document.getElementById("tmdbMoviesSearchInput");
  resultsContainer = document.getElementById("tmdbMoviesResults");
  closeBtn = document.getElementById("closeAddMoviesModal");
  btnAdd = document.getElementById("addMoviesBtn");

  // Adicionar verificações
  if (!btnAdd || !closeBtn || !searchInput || !resultsContainer) return;

  // Aplicar traduções ao título e placeholder do modal
  const titleEl = modal.querySelector("h2");
  if (titleEl) titleEl.textContent = translate("addMovieViaTMDB");
  searchInput.placeholder = translate("searchMovies");

  btnAdd.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  searchInput.addEventListener("input", handleSearch);
  resultsContainer.addEventListener("click", handleSelect);
}

function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  searchInput.value = "";
  resultsContainer.innerHTML = "";
  searchInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");  // Adicionar esta linha
}

async function handleSearch(e) {
  const q = e.target.value.trim();
  if (q.length < 2) {
    resultsContainer.innerHTML = `<p class='text-gray-400'>${translate("typeAtLeastTwoChars")}</p>`;
    return;
  }

  resultsContainer.innerHTML = translate("searching");
  const data = await searchMovies(q);
  const results = data.results || [];

  if (!results.length) {
    resultsContainer.innerHTML = translate("noMoviesFound");
    return;
  }

  resultsContainer.innerHTML = results.map(m => `
    <div class="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-800" data-id="${m.id}">
      <img src="${m.poster}" class="w-12 h-16 rounded">  <!-- Mudar h-18 para h-16 -->
      <div>
        <p class="font-semibold">${m.title}</p>
        <p class="text-xs text-gray-400">${m.year}</p>
      </div>
    </div>
  `).join("");
}

async function handleSelect(e) {
  const card = e.target.closest("[data-id]");
  if (!card) return;

  const id = card.dataset.id;

  resultsContainer.innerHTML = `
    <button id="importMovieBtn"
      class="bg-blue-600 px-4 py-2 rounded-lg w-full text-center">
      ${translate("import")}
    </button>
  `;

  const importBtn = document.getElementById("importMovieBtn");
  if (importBtn) {  // Adicionar verificação
    importBtn.addEventListener("click", () => importMovie(id));
  }
}

async function importMovie(id) {
  try {
    // Verificar se o filme já existe na lista (usar apenas cache)
    const existingMovies = await getAllMovies({ syncFromCloud: false });
    const tmdbIdToCheck = id.toString();
    
    const alreadyExists = existingMovies.some(m => {
      const existingId = (m.tmdbId || m.id)?.toString();
      return existingId === tmdbIdToCheck;
    });

    if (alreadyExists) {
      toastError(translate("movieAlreadyInList"));
      resultsContainer.innerHTML = `<p class="text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-600">⚠️ Este filme já está na sua lista!</p>`;
      return;
    }

    const movie = await getMovieDetails(id);
    if (!movie) return toastError(translate("movieImportError"));

    const formatted = {
      id: movie.id,
      tmdbId: movie.id,  // Guardar explicitamente o ID do TMDB para sincronizações futuras
      title: movie.title,
      year: movie.year,
    // URL de poster padrão (w500) para compatibilidade com o resto da UI
    poster: movie.poster,
    // Paths crus vindos do TMDB (para poderes gerar outras resoluções quando precisares)
    posterPath: movie.posterPath || null,
    backdropPath: movie.backdropPath || null,
      overview: movie.overview,
      rating: movie.rating,
      genres: movie.genres || [],
    };

    await addMovie(formatted);

    document.dispatchEvent(new Event("movieAdded"));
    toastSuccess(`✔️ ${movie.title} adicionado!`);
    closeModal();
  } catch (err) {
    console.error(err);
  toastError(translate("movieAddError"));
  }
}

