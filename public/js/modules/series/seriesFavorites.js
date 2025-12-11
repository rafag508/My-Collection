// src/modules/series/seriesFavorites.js
// Gerir lista de séries favoritas

import { isGuestMode } from "../guestMode.js";
import { storageService } from "../storageService.js";
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

const FAVORITES_KEY = "favorite_series";

// Obter todas as séries favoritas
export async function getFavoriteSeries() {
  if (isGuestMode()) {
    return await storageService.get(FAVORITES_KEY, []);
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) return [];

    const col = collection(db, `users/${uid}/favorite_series`);
    const snap = await getDocs(col);

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err.message && err.message.includes("No authenticated user")) {
      return [];
    }
    console.error("Erro ao buscar séries favoritas:", err);
    return [];
  }
}

// Adicionar série aos favoritos
export async function addSerieToFavorites(serie) {
  if (!serie) return null;

  const id = serie.id || serie.tmdbId;
  const favSerie = {
    id: id.toString(),
    tmdbId: (serie.tmdbId || serie.id)?.toString(),
    title: serie.title,
    poster: serie.poster,
    year: serie.year,
    status: serie.status,
    genres: serie.genres || [],
    rating: serie.rating || 0
  };

  if (isGuestMode()) {
    const list = await getFavoriteSeries();
    const exists = list.find(
      s => s.id === favSerie.id || s.tmdbId === favSerie.tmdbId
    );
    if (!exists) {
      list.push(favSerie);
      await storageService.set(FAVORITES_KEY, list);
    }
    return favSerie;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/favorite_series`, favSerie.id.toString());
    await setDoc(ref, favSerie);
    return favSerie;
  } catch (err) {
    console.error("Erro ao adicionar série aos favoritos:", err);
    throw err;
  }
}

// Remover série dos favoritos
export async function removeSerieFromFavorites(serieId) {
  if (!serieId) return;

  if (isGuestMode()) {
    const list = await getFavoriteSeries();
    const filtered = list.filter(
      s =>
        s.id !== serieId.toString() &&
        s.tmdbId !== serieId.toString()
    );
    await storageService.set(FAVORITES_KEY, filtered);
    return;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/favorite_series`, serieId.toString());
    await deleteDoc(ref);
  } catch (err) {
    console.error("Erro ao remover série dos favoritos:", err);
    throw err;
  }
}

// Verificar se série está nos favoritos
export async function isSerieFavorite(serieIdOrTmdb) {
  if (!serieIdOrTmdb) return false;
  const list = await getFavoriteSeries();
  const key = serieIdOrTmdb.toString();
  return list.some(
    s => s.id === key || s.tmdbId === key
  );
}


