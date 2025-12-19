// js/pages/search/searchPage.js
import { renderNavbar } from "../../ui/navbar.js";
import { renderFooter } from "../../ui/footer.js";
import { searchMovies, searchSeries } from "../../modules/tmdbApi.js";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect fill='%23374151' width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='24' font-family='Arial'%3ENo Image%3C/text%3E%3C/svg%3E";

let searchTimeout = null;
let allMovies = [];
let allSeries = [];

function getQueryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

function renderMovieCard(movie) {
  return `
    <div class="flex-shrink-0 w-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-blue-500 transition-all duration-200 group cursor-pointer">
      <a href="allmovie.html?id=${movie.id}" class="block">
        <img src="${movie.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold hover:text-blue-400 line-clamp-2 text-sm">${movie.title}</h3>
          <p class="text-xs text-gray-400">${movie.year}</p>
        </div>
      </a>
    </div>
  `;
}

function renderSeriesCard(show) {
  return `
    <div class="flex-shrink-0 w-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-green-500 transition-all duration-200 group cursor-pointer">
      <a href="allserie.html?id=${show.id}" class="block">
        <img src="${show.poster}" 
             data-placeholder="${PLACEHOLDER_IMAGE}"
             class="w-full h-72 object-cover object-top rounded-t-lg group-hover:opacity-80 transition">
        <div class="p-2 text-center">
          <h3 class="font-semibold hover:text-green-400 line-clamp-2 text-sm">${show.title}</h3>
          <p class="text-xs text-gray-400">${show.year}</p>
        </div>
      </a>
    </div>
  `;
}

function attachImageHandlers(container) {
  container.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.onerror = function() {
      this.onerror = null;
      this.src = this.getAttribute('data-placeholder');
    };
  });
}

async function performSearch(query) {
  if (!query || query.trim() === "") {
    document.getElementById("moviesGrid").innerHTML = '<p class="text-gray-400 self-center">Start typing to search...</p>';
    document.getElementById("seriesGrid").innerHTML = '<p class="text-gray-400 self-center">Start typing to search...</p>';
    allMovies = [];
    allSeries = [];
    return;
  }

  const moviesGrid = document.getElementById("moviesGrid");
  const seriesGrid = document.getElementById("seriesGrid");

  // Mostrar loading
  moviesGrid.innerHTML = '<p class="text-gray-400 self-center">Searching movies...</p>';
  seriesGrid.innerHTML = '<p class="text-gray-400 self-center">Searching series...</p>';

  try {
    // Pesquisar filmes e séries em paralelo
    const [moviesData, seriesData] = await Promise.all([
      searchMovies(query, 1),
      searchSeries(query, 1)
    ]);

    // Filtrar filmes e séries sem poster
    allMovies = (moviesData.results || []).filter(m => 
      m.poster && !m.poster.includes("default.jpg") && !m.poster.includes("No Image")
    );
    allSeries = (seriesData.results || []).filter(s => 
      s.poster && !s.poster.includes("default.jpg") && !s.poster.includes("No Image")
    );

    // Renderizar todos os resultados em scroll horizontal (sem paginação)
    if (allMovies.length > 0) {
      moviesGrid.innerHTML = allMovies.map(movie => renderMovieCard(movie)).join("");
      attachImageHandlers(moviesGrid);
    } else {
      moviesGrid.innerHTML = '<p class="text-gray-400 self-center">No movies found.</p>';
    }

    if (allSeries.length > 0) {
      seriesGrid.innerHTML = allSeries.map(show => renderSeriesCard(show)).join("");
      attachImageHandlers(seriesGrid);
    } else {
      seriesGrid.innerHTML = '<p class="text-gray-400 self-center">No series found.</p>';
    }
  } catch (err) {
    console.error("Error performing search:", err);
    moviesGrid.innerHTML = '<p class="text-gray-400 self-center">Error searching movies.</p>';
    seriesGrid.innerHTML = '<p class="text-gray-400 self-center">Error searching series.</p>';
  }
}

export async function initSearchPage() {
  renderNavbar();
  renderFooter();

  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  // Se houver query na URL, preencher o input e pesquisar
  const queryFromURL = getQueryFromURL();
  if (queryFromURL) {
    searchInput.value = queryFromURL;
    await performSearch(queryFromURL);
  }

  // Pesquisa em tempo real enquanto escreve (com debounce)
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Se estiver vazio, limpar resultados
    if (!query) {
      document.getElementById("moviesGrid").innerHTML = '<p class="text-gray-400 self-center">Start typing to search...</p>';
      document.getElementById("seriesGrid").innerHTML = '<p class="text-gray-400 self-center">Start typing to search...</p>';
      window.history.replaceState({}, '', 'search.html');
      return;
    }

    // Debounce: esperar 500ms após parar de escrever
    searchTimeout = setTimeout(async () => {
      // Atualizar URL sem recarregar
      window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
      await performSearch(query);
    }, 500);
  });

  // Permitir pesquisa imediata ao pressionar Enter
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (searchTimeout) clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query) {
        window.history.replaceState({}, '', `search.html?q=${encodeURIComponent(query)}`);
        performSearch(query);
      }
    }
  });
}
