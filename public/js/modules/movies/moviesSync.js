// js/modules/movies/moviesSync.js
// Sincroniza um filme com o TMDB para atualizar dados como genres

import { getMovieDetails } from "../tmdbApi.js";
import { getMovieById, updateMovie } from "./moviesDataManager.js";

/**
 * 🔄 Sincronizar filme com TMDB (sempre atualiza todos os campos: title, poster, description, year, rating, genres, status)
 */
export async function syncMovieFromTMDB(movieId) {
  try {
    const local = await getMovieById(movieId);
    if (!local) return { updated: false };

    const tmdbId = local.tmdbId || local.id;
    if (!tmdbId) return { updated: false };

    const remote = await getMovieDetails(tmdbId);
    if (!remote) return { updated: false };

    // Sempre atualizar todos os campos, mesmo sem mudanças aparentes
    // IMPORTANTE: Não atualizar o título durante sync para preservar o nome original
    // O título só deve ser atualizado quando o filme é adicionado pela primeira vez
    const updatedMovie = {
      ...local,
      // title: NÃO atualizar - preservar o título original que já existe
      // Atualizar poster + paths de imagem
      poster: remote.poster || local.poster,
      posterPath: remote.posterPath || local.posterPath,
      backdropPath: remote.backdropPath || local.backdropPath,
      overview: remote.overview || local.overview,
      description: remote.overview || local.description,
      year: remote.year || local.year,
      rating: remote.rating || local.rating || 0,
      genres: remote.genres || local.genres || [],
      status: remote.status || local.status || "Released"
    };

    await updateMovie(updatedMovie);

    return { updated: true };

  } catch (err) {
    console.error("moviesSync.syncMovieFromTMDB ERROR:", err);
    return { updated: false };
  }
}

/**
 * 🔄 Sincronizar todos os filmes (para atualizar genres)
 */
export async function syncAllMoviesFromTMDB() {
  const { getAllMovies } = await import("./moviesDataManager.js");
  const movies = await getAllMovies();
  
  let updated = 0;
  for (const movie of movies) {
    const result = await syncMovieFromTMDB(movie.id);
    if (result.updated) updated++;
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return { updated, total: movies.length };
}

