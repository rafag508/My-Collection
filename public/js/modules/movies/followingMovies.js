// src/modules/movies/followingMovies.js
// Gerir lista de filmes "Following" (filmes upcoming que o utilizador quer seguir)

import { isGuestMode } from "../guestMode.js";
import { storageService } from "../storageService.js";
import { addNotification } from "../notifications.js";
import { db } from "../../firebase/firestore.js";
import { getCurrentUID } from "../../firebase/auth.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FOLLOWING_KEY = "following_movies";

// Obter todos os filmes seguidos
export async function getFollowingMovies() {
  if (isGuestMode()) {
    return await storageService.get(FOLLOWING_KEY, []);
  }
  
  try {
    const uid = await getCurrentUID();
    if (!uid) return [];
    
    const col = collection(db, `users/${uid}/following_movies`);
    const snap = await getDocs(col);
    
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Se não houver autenticação, retornar array vazio (não é erro crítico)
    if (err.message && err.message.includes("No authenticated user")) {
      return [];
    }
    console.error("Erro ao buscar filmes seguidos:", err);
    return [];
  }
}

// Adicionar filme à lista following
export async function addToFollowing(movie) {
  const followingMovie = {
    id: movie.id || movie.tmdbId,
    tmdbId: movie.tmdbId || movie.id,
    title: movie.title,
    poster: movie.poster,
    // Paths crus para poderes construir URLs de alta resolução no hero
    posterPath: movie.posterPath || null,
    backdropPath: movie.backdropPath || null,
    release_date: movie.release_date || movie.releaseDate || null,
    year: movie.year
  };
  
  if (isGuestMode()) {
    const following = await getFollowingMovies();
    const exists = following.find(m => 
      m.id === followingMovie.id || m.tmdbId === followingMovie.tmdbId
    );
    if (!exists) {
      following.push(followingMovie);
      await storageService.set(FOLLOWING_KEY, following);
    }
    return followingMovie;
  }
  
  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");
    
    const ref = doc(db, `users/${uid}/following_movies`, followingMovie.id.toString());
    await setDoc(ref, followingMovie);
    return followingMovie;
  } catch (err) {
    console.error("Erro ao adicionar filme à lista following:", err);
    throw err;
  }
}

// Remover filme da lista following
export async function removeFromFollowing(movieId) {
  if (isGuestMode()) {
    const following = await getFollowingMovies();
    const filtered = following.filter(m => 
      m.id !== movieId.toString() && m.tmdbId !== movieId.toString()
    );
    await storageService.set(FOLLOWING_KEY, filtered);
    return;
  }
  
  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");
    
    const ref = doc(db, `users/${uid}/following_movies`, movieId.toString());
    await deleteDoc(ref);
  } catch (err) {
    console.error("Erro ao remover filme da lista following:", err);
    throw err;
  }
}

// Verificar se filme está na lista following
export async function isFollowing(movieId) {
  const following = await getFollowingMovies();
  return following.some(m => 
    m.id === movieId.toString() || m.tmdbId === movieId.toString()
  );
}

// ------------------------------------------------------------------
// 🔔 Verificar lançamentos de filmes em "following" e criar notificações
// ------------------------------------------------------------------
function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function markReleaseNotifiedLocal(list, movieId) {
  const updated = list.map(m =>
    (m.id?.toString() === movieId.toString() || m.tmdbId?.toString() === movieId.toString())
      ? { ...m, releaseNotified: true }
      : m
  );
  await storageService.set(FOLLOWING_KEY, updated);
}

async function markReleaseNotifiedRemote(movieId) {
  const uid = await getCurrentUID();
  if (!uid) return;
  const ref = doc(db, `users/${uid}/following_movies`, movieId.toString());
  await setDoc(ref, { releaseNotified: true }, { merge: true });
}

export async function checkMovieReleases() {
  try {
    const following = await getFollowingMovies();
    if (!Array.isArray(following) || following.length === 0) return;

    const todayStr = formatDateYYYYMMDD(new Date());

    // Verificar notificações existentes para evitar duplicados
    const { getNotifications } = await import("../notifications.js");
    const existingNotifications = await getNotifications();
    const existingMovieIds = new Set(
      existingNotifications
        .filter(n => n.type === "movie_release" && n.movieId)
        .map(n => n.movieId.toString())
    );

    for (const movie of following) {
      const movieId = movie.id || movie.tmdbId;
      if (!movieId) continue;

      const rd = movie.release_date;
      if (!rd) continue;

      // Comparar apenas a parte da data YYYY-MM-DD
      const releaseDateStr = typeof rd === "string" ? rd.slice(0, 10) : String(rd);
      if (releaseDateStr !== todayStr) continue;

      // ✅ VERIFICAR PRIMEIRO se já foi notificado (releaseNotified = true)
      // Se já foi notificado, não criar notificação novamente, mesmo que não exista notificação local
      // (o utilizador pode ter apagado manualmente com "Clear All")
      if (movie.releaseNotified) {
        continue; // Já foi notificado, não criar novamente
      }

      // Verificar se já existe notificação local para este filme
      // Se já existe, não criar duplicado
      if (existingMovieIds.has(movieId.toString())) {
        continue; // Já existe notificação local, não criar duplicado
      }

      // Criar notificação local (apenas se releaseNotified = false e não existe notificação local)
      await addNotification({
        movieId: movieId.toString(),
        movieTitle: movie.title,
        moviePoster: movie.poster || null,
        movieYear: movie.year || null,
        timestamp: Date.now(),
        type: "movie_release",
      });

      // Marcar como notificado localmente (para evitar criar novamente)
      await markReleaseNotifiedLocal(following, movieId);
      
      // Só marcar remotamente se ainda não estiver marcado
      // (evita writes desnecessários se já foi marcado pela função Vercel)
      if (!isGuestMode() && !movie.releaseNotified) {
        try {
          await markReleaseNotifiedRemote(movieId);
        } catch (err) {
          console.warn("followingMovies.checkMovieReleases: could not mark releaseNotified in Firestore", err);
        }
      }
    }
  } catch (err) {
    console.warn("followingMovies.checkMovieReleases failed:", err);
  }
}
