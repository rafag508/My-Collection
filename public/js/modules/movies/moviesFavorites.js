// src/modules/movies/moviesFavorites.js
// Gerir lista de filmes favoritos

import { isGuestMode } from "../guestMode.js";
import { storageService } from "../storageService.js";
import { db } from "../../firebase/firestore.js";
import { getCurrentUID } from "../../firebase/auth.js";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FAVORITES_KEY = "favorite_movies";

// Obter todos os filmes favoritos
export async function getFavoriteMovies() {
  if (isGuestMode()) {
    return await storageService.get(FAVORITES_KEY, []);
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) return [];

    const col = collection(db, `users/${uid}/favorite_movies`);
    const snap = await getDocs(col);

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err.message && err.message.includes("No authenticated user")) {
      return [];
    }
    console.error("Erro ao buscar filmes favoritos:", err);
    return [];
  }
}

// Adicionar filme aos favoritos
export async function addMovieToFavorites(movie) {
  if (!movie) return null;

  const id = movie.id || movie.tmdbId;
  const favMovie = {
    id: id.toString(),
    tmdbId: (movie.tmdbId || movie.id)?.toString(),
    title: movie.title,
    poster: movie.poster,
    year: movie.year,
    genres: movie.genres || [],
    rating: movie.rating || 0,
    release_date: movie.release_date || movie.releaseDate || null
  };

  if (isGuestMode()) {
    const list = await getFavoriteMovies();
    const exists = list.find(
      m => m.id === favMovie.id || m.tmdbId === favMovie.tmdbId
    );
    if (!exists) {
      list.push(favMovie);
      await storageService.set(FAVORITES_KEY, list);
    }
    return favMovie;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/favorite_movies`, favMovie.id.toString());
    await setDoc(ref, favMovie);
    return favMovie;
  } catch (err) {
    console.error("Erro ao adicionar filme aos favoritos:", err);
    throw err;
  }
}

// Remover filme dos favoritos
export async function removeMovieFromFavorites(movieId) {
  if (!movieId) return;

  if (isGuestMode()) {
    const list = await getFavoriteMovies();
    const filtered = list.filter(
      m =>
        m.id !== movieId.toString() &&
        m.tmdbId !== movieId.toString()
    );
    await storageService.set(FAVORITES_KEY, filtered);
    return;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/favorite_movies`, movieId.toString());
    await deleteDoc(ref);
  } catch (err) {
    console.error("Erro ao remover filme dos favoritos:", err);
    throw err;
  }
}

// Verificar se filme está nos favoritos
export async function isMovieFavorite(movieIdOrTmdb) {
  if (!movieIdOrTmdb) return false;
  const list = await getFavoriteMovies();
  const key = movieIdOrTmdb.toString();
  return list.some(
    m => m.id === key || m.tmdbId === key
  );
}



