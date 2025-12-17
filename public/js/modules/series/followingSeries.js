// src/modules/series/followingSeries.js
// Gerir lista de séries "Following" (séries que o utilizador quer seguir para notificações)

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
import { addNotification } from "../notifications.js";
import { getSeriesDetails } from "../tmdbApi.js";

const FOLLOWING_KEY = "following_series";

// Obter todas as séries seguidas
export async function getFollowingSeries() {
  if (isGuestMode()) {
    return await storageService.get(FOLLOWING_KEY, []);
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) return [];

    const col = collection(db, `users/${uid}/following_series`);
    const snap = await getDocs(col);

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err.message && err.message.includes("No authenticated user")) {
      return [];
    }
    console.error("Erro ao buscar séries following:", err);
    return [];
  }
}

// Adicionar série à lista following
export async function addSerieToFollowing(serie) {
  if (!serie) return null;

  const id = serie.id || serie.tmdbId;
  const followSerie = {
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
    const list = await getFollowingSeries();
    const exists = list.find(
      s => s.id === followSerie.id || s.tmdbId === followSerie.tmdbId
    );
    if (!exists) {
      list.push(followSerie);
      await storageService.set(FOLLOWING_KEY, list);
    }
    return followSerie;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/following_series`, followSerie.id.toString());
    await setDoc(ref, followSerie);
    return followSerie;
  } catch (err) {
    console.error("Erro ao adicionar série a following_series:", err);
    throw err;
  }
}

// Remover série da lista following
export async function removeSerieFromFollowing(serieId) {
  if (!serieId) return;

  if (isGuestMode()) {
    const list = await getFollowingSeries();
    const filtered = list.filter(
      s =>
        s.id !== serieId.toString() &&
        s.tmdbId !== serieId.toString()
    );
    await storageService.set(FOLLOWING_KEY, filtered);
    return;
  }

  try {
    const uid = await getCurrentUID();
    if (!uid) throw new Error("User not authenticated");

    const ref = doc(db, `users/${uid}/following_series`, serieId.toString());
    await deleteDoc(ref);
  } catch (err) {
    console.error("Erro ao remover série de following_series:", err);
    throw err;
  }
}

// Verificar se série está em following
export async function isSerieFollowing(serieIdOrTmdb) {
  if (!serieIdOrTmdb) return false;
  const list = await getFollowingSeries();
  const key = serieIdOrTmdb.toString();
  return list.some(
    s => s.id === key || s.tmdbId === key
  );
}

// Utils para notificações de episódios em estreia
function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildEpisodeKey(nextEpisode) {
  const s = nextEpisode?.seasonNumber;
  const e = nextEpisode?.episodeNumber;
  if (s == null || e == null) return null;
  return `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
}

async function markEpisodeReleaseNotifiedLocal(list, serieId, episodeKey) {
  const updated = list.map(s =>
    (s.id?.toString() === serieId.toString() || s.tmdbId?.toString() === serieId.toString())
      ? { ...s, lastEpisodeNotified: episodeKey }
      : s
  );
  await storageService.set(FOLLOWING_KEY, updated);
}

async function markEpisodeReleaseNotifiedRemote(serieId, episodeKey) {
  const uid = await getCurrentUID();
  if (!uid) return;
  const ref = doc(db, `users/${uid}/following_series`, serieId.toString());
  await setDoc(ref, { lastEpisodeNotified: episodeKey }, { merge: true });
}

// Verificar estreias de episódios hoje para séries em Following
export async function checkSeriesReleases() {
  try {
    const following = await getFollowingSeries();
    if (!Array.isArray(following) || following.length === 0) return;

    const todayStr = formatDateYYYYMMDD(new Date());

    for (const serie of following) {
      const serieId = serie.tmdbId || serie.id;
      if (!serieId) continue;

      // Buscar detalhes da série (inclui next_episode_to_air)
      let details;
      try {
        details = await getSeriesDetails(serieId);
      } catch (err) {
        console.warn("checkSeriesReleases: getSeriesDetails failed for serie", serieId, err);
        continue;
      }

      const nextEpisode = details?.nextEpisode;
      const airDate = nextEpisode?.air_date;
      if (!nextEpisode || !airDate) continue;

      const airDateStr = typeof airDate === "string" ? airDate.slice(0, 10) : String(airDate);
      if (airDateStr !== todayStr) continue;

      const episodeKey = buildEpisodeKey(nextEpisode);
      if (!episodeKey) continue;

      // Evitar notificação duplicada para o mesmo episódio
      if (serie.lastEpisodeNotified === episodeKey) continue;

      // Criar notificação específica de estreia de episódio
      await addNotification({
        type: "series_episode_release",
        serieId: serieId.toString(),
        serieName: serie.title,
        seriePoster: serie.poster || null,
        season: nextEpisode.seasonNumber,
        episode: nextEpisode.episodeNumber,
        episodeName: nextEpisode.name || null,
        airDate: airDateStr,
        timestamp: Date.now()
      });

      // Marcar episódio como notificado (local + remoto)
      await markEpisodeReleaseNotifiedLocal(following, serieId, episodeKey);
      if (!isGuestMode()) {
        try {
          await markEpisodeReleaseNotifiedRemote(serieId, episodeKey);
        } catch (err) {
          console.warn("followingSeries.checkSeriesReleases: could not mark lastEpisodeNotified in Firestore", err);
        }
      }
    }
  } catch (err) {
    console.warn("followingSeries.checkSeriesReleases failed:", err);
  }
}

