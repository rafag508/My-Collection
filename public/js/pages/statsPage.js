import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { getAllSeries } from "../modules/series/seriesDataManager.js";
import { getAllMovies } from "../modules/movies/moviesDataManager.js";
import { loadProgress as loadSeriesProgress, countWatchedEpisodes, isSerieCompletelyWatched } from "../modules/series/seriesProgress.js";
import { loadProgress as loadMoviesProgress } from "../modules/movies/moviesProgress.js";
import { storageService } from "../modules/storageService.js";
import { t as translate } from "../modules/idioma.js";

// rough averages for time estimates
const EPISODE_AVG_MIN = 45;
const MOVIE_AVG_MIN = 120;

let currentSeriesStats = null;
let currentMovieStats = null;

export async function initStatsPage() {
  renderNavbar();
  renderFooter();

  const root = document.getElementById("statsRoot");
  if (!root) return;

  // 1️⃣ CARREGAR CACHE LOCAL IMEDIATAMENTE (instantâneo)
  const localSeries = await storageService.get("series", []);
  const localMovies = await storageService.get("movies", []);
  const localSeriesProgress = await storageService.get("series_progress", {});
  const localMoviesProgress = await storageService.get("movies_progress", {});

  // Calcular stats com cache local
  const moviesWatchedMap = {};
  for (const [movieId, data] of Object.entries(localMoviesProgress || {})) {
    moviesWatchedMap[movieId] = data.watched || false;
  }

  const seriesStats = await computeSeriesStats(Array.isArray(localSeries) ? localSeries : [], localSeriesProgress || {});
  const movieStats = await computeMovieStats(Array.isArray(localMovies) ? localMovies : [], moviesWatchedMap);

  currentSeriesStats = seriesStats;
  currentMovieStats = movieStats;

  renderStats(root, seriesStats, movieStats);  // ⚡ Renderiza IMEDIATAMENTE

  // 2️⃣ SINCRONIZAR EM BACKGROUND E ATUALIZAR (não bloqueia)
  try {
    const [series, movies, progressMap, moviesProgress] = await Promise.all([
      getAllSeries(),
      getAllMovies(),
      loadSeriesProgress(),
      loadMoviesProgress(),
    ]);

    // Recalcular stats com dados atualizados
    const updatedMoviesWatchedMap = {};
    for (const [movieId, data] of Object.entries(moviesProgress || {})) {
      updatedMoviesWatchedMap[movieId] = data.watched || false;
    }

    const updatedSeriesStats = await computeSeriesStats(series || [], progressMap || {});
    const updatedMovieStats = await computeMovieStats(movies || [], updatedMoviesWatchedMap);

    currentSeriesStats = updatedSeriesStats;
    currentMovieStats = updatedMovieStats;

    renderStats(root, updatedSeriesStats, updatedMovieStats);
  } catch (err) {
    console.error("Error loading stats:", err);
    // Não substituir a UI - já está renderizada com cache
  }

  // Atualizar textos quando o idioma mudar
  document.addEventListener("languageChanged", () => {
    if (currentSeriesStats && currentMovieStats) {
      renderStats(root, currentSeriesStats, currentMovieStats);
    }
  });
}

async function computeSeriesStats(series, progressMap) {
  const totalSeries = series.length;

  // Calculate stillWatching from progress (series not completely watched)
  const stillWatching = series.filter(s => {
    const progress = progressMap[s.id] || { watched: {} };
    return !isSerieCompletelyWatched(s, progress);
  }).length;

  let episodesWatched = 0;
  series.forEach(serie => {
    const progress = progressMap[serie.id] || { watched: {} };
    try {
      const info = countWatchedEpisodes(serie, progress);
      episodesWatched += info.watched || 0;
    } catch (err) {
      console.warn("Error counting episodes for serie:", serie.id, err);
    }
  });

  const totalMinutes = episodesWatched * EPISODE_AVG_MIN;
  const timeBreakdown = breakdownMinutes(totalMinutes);

  const genres = countGenres(series);

  return {
    totalSeries,
    stillWatching,
    episodesWatched,
    episodesLast7Days: 0, // no per-day tracking yet
    totalMinutes,
    timeBreakdown,
    hoursLast7Days: 0, // placeholder
    genres,
  };
}

async function computeMovieStats(movies, watchedMap) {
  const totalMovies = movies.length;

  const watchedMovies = movies.filter(m => watchedMap[m.id]).length;

  const totalMinutes = watchedMovies * MOVIE_AVG_MIN;
  const timeBreakdown = breakdownMinutes(totalMinutes);

  const genres = countGenres(movies);

  return {
    totalMovies,
    watchedMovies,
    watchedLast7Days: 0, // placeholder
    totalMinutes,
    timeBreakdown,
    hoursLast7Days: 0, // placeholder
    genres,
  };
}

// minutes -> { months, days, hours, totalHours }
function breakdownMinutes(totalMinutes) {
  const totalHours = Math.round(totalMinutes / 60);
  const hoursPerDay = 24;
  const daysPerMonth = 30;

  let remainingHours = totalHours;
  const months = Math.floor(remainingHours / (hoursPerDay * daysPerMonth));
  remainingHours -= months * hoursPerDay * daysPerMonth;

  const days = Math.floor(remainingHours / hoursPerDay);
  remainingHours -= days * hoursPerDay;

  const hours = remainingHours;

  return { months, days, hours, totalHours };
}

// tries to read serie.genres / movie.genres (array of strings)
function countGenres(items) {
  if (!Array.isArray(items)) return [];
  const map = {};
  items.forEach(item => {
    if (!item) return;
    let genres = [];
    if (Array.isArray(item.genres)) {
      genres = item.genres;
    } else if (typeof item.genre === "string") {
      genres = [item.genre];
    }
    genres.forEach(g => {
      const name = String(g).trim();
      if (!name) return;
      map[name] = (map[name] || 0) + 1;
    });
  });

  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function renderStats(root, seriesStats, movieStats) {
  const s = seriesStats;
  const m = movieStats;

  root.innerHTML = `
    <h1 class="text-3xl font-extrabold mb-6">${translate("statsTitle")}</h1>

    <div class="grid md:grid-cols-2 gap-6">
      <!-- Series -->
      <section class="bg-gray-900 border border-white/10 rounded-2xl p-5">
        <h2 class="text-xl font-bold mb-4 text-green-400">${translate("tvShows")}</h2>

        <div class="space-y-4 text-sm">
          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("totalAdded")}</p>
            <p class="text-2xl font-extrabold">${s.totalSeries}</p>
            <p class="mt-1 text-gray-300">${s.stillWatching} ${translate("stillWatching")}</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("totalEpisodesWatched")}</p>
            <p class="text-2xl font-extrabold">${s.episodesWatched}</p>
            <p class="mt-1 text-gray-400">${s.episodesLast7Days} ${translate("inTheLast7Days")}</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("timeSpentWatchingEpisodes")}</p>
            <p class="text-lg">
              ${s.timeBreakdown.months} ${translate("months") || "meses"}
              ${s.timeBreakdown.days} ${translate("days") || "dias"}
              ${s.timeBreakdown.hours} ${translate("hours")}
              <span class="text-gray-400 ml-2">(${s.timeBreakdown.totalHours} ${translate("hours")})</span>
            </p>
            <p class="mt-1 text-gray-400">${s.hoursLast7Days} ${translate("hours")} ${translate("inTheLast7Days")}</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-2">${translate("mainGenresOfSeries")}</p>
            ${
              s.genres.length === 0
                ? `<p class="text-gray-400 text-xs">${translate("noGenreDataAvailable")}</p>`
                : `
              <div class="grid grid-cols-[1fr_auto] gap-y-1 text-xs md:text-sm">
                <div class="text-gray-400">${translate("genreLabel")}</div>
                <div class="text-gray-400 text-right">${translate("seriesLabel")}</div>
                ${s.genres
                  .map(
                    g => `
                <div>${g.name}</div>
                <div class="text-right">${g.count}</div>`
                  )
                  .join("")}
              </div>`
            }
          </div>
        </div>
      </section>

      <!-- Movies -->
      <section class="bg-gray-900 border border-white/10 rounded-2xl p-5">
        <h2 class="text-xl font-bold mb-4 text-blue-400">${translate("movies")}</h2>

        <div class="space-y-4 text-sm">
          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("totalAdded")}</p>
            <p class="text-2xl font-extrabold">${m.totalMovies}</p>
            <p class="mt-1 text-gray-300">&nbsp;</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("totalMoviesWatched")}</p>
            <p class="text-2xl font-extrabold">${m.watchedMovies}</p>
            <p class="mt-1 text-gray-400">${m.watchedLast7Days} ${translate("inTheLast7Days")}</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">${translate("timeSpentWatchingMovies")}</p>
            <p class="text-lg">
              ${m.timeBreakdown.months} ${translate("months") || "meses"}
              ${m.timeBreakdown.days} ${translate("days") || "dias"}
              ${m.timeBreakdown.hours} ${translate("hours")}
              <span class="text-gray-400 ml-2">(${m.timeBreakdown.totalHours} ${translate("hours")})</span>
            </p>
            <p class="mt-1 text-gray-400">${m.hoursLast7Days} ${translate("hours")} ${translate("inTheLast7Days")}</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-2">${translate("mainGenresOfMovies")}</p>
            ${
              m.genres.length === 0
                ? `<p class="text-gray-400 text-xs">${translate("noGenreDataAvailable")}</p>`
                : `
              <div class="grid grid-cols-[1fr_auto] gap-y-1 text-xs md:text-sm">
                <div class="text-gray-400">${translate("genreLabel")}</div>
                <div class="text-gray-400 text-right">${translate("moviesLabel")}</div>
                ${m.genres
                  .map(
                    g => `
                <div>${g.name}</div>
                <div class="text-right">${g.count}</div>`
                  )
                  .join("")}
              </div>`
            }
          </div>
        </div>
      </section>
    </div>
  `;
}
