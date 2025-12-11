import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { getAllSeries } from "../modules/series/seriesDataManager.js";
import { getAllMovies } from "../modules/movies/moviesDataManager.js";
import { loadProgress as loadSeriesProgress, countWatchedEpisodes, isSerieCompletelyWatched } from "../modules/series/seriesProgress.js";
import { loadProgress as loadMoviesProgress } from "../modules/movies/moviesProgress.js";
import { storageService } from "../modules/storageService.js";

// rough averages for time estimates
const EPISODE_AVG_MIN = 45;
const MOVIE_AVG_MIN = 120;

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

    renderStats(root, updatedSeriesStats, updatedMovieStats);
  } catch (err) {
    console.error("Error loading stats:", err);
    // Não substituir a UI - já está renderizada com cache
  }
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
    <h1 class="text-3xl font-extrabold mb-6">Stats</h1>

    <div class="grid md:grid-cols-2 gap-6">
      <!-- Series -->
      <section class="bg-gray-900 border border-white/10 rounded-2xl p-5">
        <h2 class="text-xl font-bold mb-4 text-green-400">Series</h2>

        <div class="space-y-4 text-sm">
          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Total added</p>
            <p class="text-2xl font-extrabold">${s.totalSeries}</p>
            <p class="mt-1 text-gray-300">${s.stillWatching} still watching</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Total episodes watched</p>
            <p class="text-2xl font-extrabold">${s.episodesWatched}</p>
            <p class="mt-1 text-gray-400">${s.episodesLast7Days} in the last 7 days</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Time spent watching episodes</p>
            <p class="text-lg">
              ${s.timeBreakdown.months} months
              ${s.timeBreakdown.days} days
              ${s.timeBreakdown.hours} hours
              <span class="text-gray-400 ml-2">(${s.timeBreakdown.totalHours} hours)</span>
            </p>
            <p class="mt-1 text-gray-400">${s.hoursLast7Days} hours in the last 7 days</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-2">Main genres of series</p>
            ${
              s.genres.length === 0
                ? `<p class="text-gray-400 text-xs">No genre data available yet.</p>`
                : `
              <div class="grid grid-cols-[1fr_auto] gap-y-1 text-xs md:text-sm">
                <div class="text-gray-400">Genre</div>
                <div class="text-gray-400 text-right">Series</div>
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
        <h2 class="text-xl font-bold mb-4 text-blue-400">Movies</h2>

        <div class="space-y-4 text-sm">
          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Total added</p>
            <p class="text-2xl font-extrabold">${m.totalMovies}</p>
            <p class="mt-1 text-gray-300">&nbsp;</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Total movies watched</p>
            <p class="text-2xl font-extrabold">${m.watchedMovies}</p>
            <p class="mt-1 text-gray-400">${m.watchedLast7Days} in the last 7 days</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-1">Time spent watching movies</p>
            <p class="text-lg">
              ${m.timeBreakdown.months} months
              ${m.timeBreakdown.days} days
              ${m.timeBreakdown.hours} hours
              <span class="text-gray-400 ml-2">(${m.timeBreakdown.totalHours} hours)</span>
            </p>
            <p class="mt-1 text-gray-400">${m.hoursLast7Days} hours in the last 7 days</p>
          </div>

          <div class="border-t border-white/10 pt-3">
            <p class="font-semibold mb-2">Main genres of movies</p>
            ${
              m.genres.length === 0
                ? `<p class="text-gray-400 text-xs">No genre data available yet.</p>`
                : `
              <div class="grid grid-cols-[1fr_auto] gap-y-1 text-xs md:text-sm">
                <div class="text-gray-400">Genre</div>
                <div class="text-gray-400 text-right">Movies</div>
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
