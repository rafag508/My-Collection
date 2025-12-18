import { searchSeries, getSeriesDetails, importFullSeries } from "../../modules/tmdbApi.js";
import { addSerie, getAllSeries } from "../../modules/series/seriesDataManager.js";
import { toastSuccess, toastError } from "../../ui/toast.js";
import { t as translate } from "../../modules/idioma.js";

// Note: addSerie() already syncs to Firestore automatically - no need for manual sync

let modal, searchInput, resultsContainer, closeBtn, addSeriesBtn;

export function setupAddSeriesModal() {
  modal = document.getElementById("addSeriesModal");
  if (!modal) return;
  searchInput = document.getElementById("tmdbSearchInput");
  resultsContainer = document.getElementById("tmdbResults");
  closeBtn = document.getElementById("closeAddModal");
  addSeriesBtn = document.getElementById("addSeriesBtn");

  addSeriesBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  searchInput.addEventListener("input", onSearchInput);
  resultsContainer.addEventListener("click", onSelectSeries);

  // Aplicar traduções ao título e placeholder do modal
  const titleEl = modal.querySelector("h2");
  if (titleEl) titleEl.textContent = translate("addSeriesViaTMDB");
  searchInput.placeholder = translate("searchSeries");

  // Fechar ao clicar fora
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
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
  modal.classList.remove("flex");
}

async function onSearchInput(e) {
  const q = e.target.value.trim();
  if (q.length < 2) {
    resultsContainer.innerHTML = `<p class="text-gray-400 text-sm">${translate("typeAtLeastTwoChars")}</p>`;
    return;
  }
  resultsContainer.innerHTML = `<p class="text-gray-400">${translate("searching")}</p>`;
  const data = await searchSeries(q);
  const results = data.results || [];
  if (!results.length) {
    resultsContainer.innerHTML = `<p class="text-gray-400">${translate("noResultsFound")}</p>`;
    return;
  }
  resultsContainer.innerHTML = results.map(serie => `
    <div class="flex items-center gap-4 p-2 hover:bg-gray-800 rounded-lg cursor-pointer" data-id="${serie.id}">
      <img src="${serie.poster}" class="w-16 h-24 object-cover rounded" />
      <div>
        <p class="font-semibold">${serie.title}</p>
        <p class="text-sm text-gray-400">${serie.year}</p>
      </div>
    </div>
  `).join("");
}

async function onSelectSeries(e) {
  const card = e.target.closest("[data-id]");
  if (!card) return;
  const id = card.getAttribute("data-id");
  resultsContainer.innerHTML = `
    <div class="p-4 bg-gray-800 rounded-lg">
      <h3 class="text-lg font-bold mb-2">⚙️ Opções de Importação</h3>
      <label class="flex items-center gap-2 mb-2">
        <input type="checkbox" id="includeSeasons" checked class="w-4 h-4 accent-green-500">
        <span>Incluir temporadas e episódios</span>
      </label>
      <label class="flex items-center gap-2 mb-4">
        <input type="checkbox" id="useTitles" checked class="w-4 h-4 accent-green-500">
        <span>Usar nomes oficiais dos episódios</span>
      </label>
      <button id="importSerieBtn" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg w-full font-semibold">📥 ${translate("import")}</button>
    </div>
  `;
  document.getElementById("importSerieBtn").addEventListener("click", () => importSerie(id));
}

async function importSerie(id) {
  // Verificar se a série já existe na lista
  const existingSeries = await getAllSeries();
  const tmdbIdToCheck = id.toString();
  
  const alreadyExists = existingSeries.some(s => {
    const existingId = (s.tmdbId || s.id)?.toString();
    return existingId === tmdbIdToCheck;
  });

  if (alreadyExists) {
    toastError(translate("seriesAlreadyInList"));
    resultsContainer.innerHTML = `<p class="text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-600">⚠️ Esta série já está na sua lista!</p>`;
    return;
  }

  const includeSeasons = document.getElementById("includeSeasons").checked;
  const useTitles = document.getElementById("useTitles").checked;
  resultsContainer.innerHTML = `<p class="text-gray-400">📦 A importar série completa...</p>`;
  try {
    let serieData = includeSeasons ? await importFullSeries(id) : await getSeriesDetails(id);
    if (!serieData) { toastError(translate("seriesImportError")); return; }
    if (!includeSeasons) serieData.seasons = [];
    const formatted = {
      id: serieData.id.toString(),
      tmdbId: serieData.id.toString(),  // Guardar explicitamente o ID do TMDB para sincronizações futuras
      title: serieData.title,
      year: serieData.year,
      poster: serieData.poster,
      description: serieData.description,
      status: serieData.status,
      genres: serieData.genres || [],
      rating: serieData.rating || 0,
      seasons: includeSeasons
        ? serieData.seasons.map(s => ({
            number: s.number,
            episodes: s.episodes.map((ep, i) => ({
              title: useTitles ? ep.title : `Ep. ${i + 1}`
            }))
          }))
        : []
    };

    await addSerie(formatted);
    // Note: addSerie() already syncs to Firestore automatically

    // 🔥 FIX: enviar evento correto para atualizar automaticamente a seriesPage
    document.dispatchEvent(new CustomEvent("seriesAdded"));

    toastSuccess(`✔️ "${formatted.title}" adicionada!`);
    closeModal();
  } catch (err) {
    console.error(err);
    toastError(translate("seriesImportError"));
  }
}

export { importSerie };

