// public/js/modules/tmdbApi.js
// ✅ API KEY removida - agora usa Vercel Serverless Functions proxy

const LANGUAGE = "en-US";

// Base genérico para construir URLs de imagem em diferentes resoluções
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
// Compatibilidade com código existente que usa poster em w500
const IMAGE_BASE = `${TMDB_IMAGE_BASE}/w500`;

// Vercel API URL - relativa ao domínio atual
const TMDB_PROXY_URL = "/api/tmdb";

// =====================================================
// 🔒 TMDB PROXY HELPER
// =====================================================
// Faz chamadas ao TMDB através do Vercel Serverless Functions proxy
// (mantém a API key segura no servidor)
async function callTmdbProxy(endpoint, params = {}) {
  try {
    const response = await fetch(TMDB_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint,
        params,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("❌ Erro ao chamar TMDB proxy:", err);
    throw err;
  }
}

// =====================================================
// 🔍 SEARCH MOVIES
// =====================================================
export async function searchMovies(query, page = 1) {
  try {
    const data = await callTmdbProxy("search/movie", {
      language: LANGUAGE,
      query: encodeURIComponent(query),
      page: page.toString(),
    });
    
    if (!data.results) return { results: [], totalPages: 0, currentPage: 1 };

    return {
      results: data.results.map(m => ({
        id: m.id.toString(),
        title: m.title || "Untitled",
        year: m.release_date ? m.release_date.split("-")[0] : "—",
        poster: m.poster_path
          ? `${IMAGE_BASE}${m.poster_path}`
          : "./assets/default.jpg",
        overview: m.overview || "",
        rating: m.vote_average || 0,
      })),
      totalPages: Math.min(data.total_pages || 0, 500),
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao procurar filme:", err);
    return { results: [], totalPages: 0, currentPage: 1 };
  }
}

// =====================================================
// 🎬 MOVIE DETAILS
// =====================================================
export async function getMovieDetails(movieId) {
  try {
    const data = await callTmdbProxy(`movie/${movieId}`, {
      language: LANGUAGE,
    });

    const posterPath = data.poster_path || null;
    const backdropPath = data.backdrop_path || null;

    return {
      id: movieId.toString(),
      title: data.title || "Untitled",
      year: data.release_date ? data.release_date.split("-")[0] : "—",
      release_date: data.release_date || null,
      // URL de poster em resolução média (compatível com código antigo)
      poster: posterPath
        ? `${IMAGE_BASE}${posterPath}`
        : "./assets/default.jpg",
      // Novos campos: apenas os paths, para poderes construir URLs noutras resoluções
      posterPath,
      backdropPath,
      overview: data.overview || "",
      status: data.status || "Released",
      genres: (data.genres || []).map(g => g.name),
      rating: data.vote_average || 0,
    };
  } catch (err) {
    console.error("❌ Erro ao obter detalhes do filme:", err);
    return null;
  }
}

// =====================================================
// 🎬 MOVIE VIDEOS (TRAILERS)
// =====================================================
export async function getMovieVideos(movieId) {
  try {
    const data = await callTmdbProxy(`movie/${movieId}/videos`, {
      language: LANGUAGE,
    });
    
    if (!data.results || !Array.isArray(data.results)) {
      return null;
    }
    
    // Buscar o primeiro vídeo com type="Trailer" e site="YouTube"
    const trailer = data.results.find(
      video => video.type === "Trailer" && video.site === "YouTube"
    );
    
    if (!trailer || !trailer.key) {
      return null;
    }
    
    return {
      key: trailer.key,
      name: trailer.name || "Trailer",
      youtubeUrl: `https://www.youtube.com/embed/${trailer.key}`
    };
  } catch (err) {
    console.error("❌ Erro ao obter vídeos do filme:", err);
    return null;
  }
}

// =====================================================
// 📺 SERIES VIDEOS (TRAILERS)
// =====================================================
export async function getSeriesVideos(seriesId) {
  try {
    const data = await callTmdbProxy(`tv/${seriesId}/videos`, {
      language: LANGUAGE,
    });
    
    if (!data.results || !Array.isArray(data.results)) {
      return null;
    }
    
    // Buscar o primeiro vídeo com type="Trailer" e site="YouTube"
    const trailer = data.results.find(
      video => video.type === "Trailer" && video.site === "YouTube"
    );
    
    if (!trailer || !trailer.key) {
      return null;
    }
    
    return {
      key: trailer.key,
      name: trailer.name || "Trailer",
      youtubeUrl: `https://www.youtube.com/embed/${trailer.key}`
    };
  } catch (err) {
    console.error("❌ Erro ao obter vídeos da série:", err);
    return null;
  }
}

// =====================================================
// 📽️ GET POPULAR MOVIES (for allmovies.html)
// =====================================================
export async function getPopularMovies(page = 1) {
  try {
    const data = await callTmdbProxy("movie/popular", {
      language: LANGUAGE,
      page: page.toString(),
    });
    
    if (!data.results) return { results: [], totalPages: 0 };

    return {
      results: data.results.map(m => ({
        id: m.id.toString(),
        title: m.title || "Untitled",
        year: m.release_date ? m.release_date.split("-")[0] : "—",
        poster: m.poster_path
          ? `${IMAGE_BASE}${m.poster_path}`
          : "./assets/default.jpg",
        overview: m.overview || "",
        rating: m.vote_average || 0,
      })),
      totalPages: data.total_pages || 0,
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao obter filmes populares:", err);
    return { results: [], totalPages: 0 };
  }
}

// =====================================================
// 🎬 GET UPCOMING MOVIES (exatamente como TMDB)
// =====================================================
export async function getUpcomingMovies(page = 1, dateFrom = null, dateTo = null, releaseType = '3') {
  try {
    // Se release type for "Theatrical" (3) ou "Theatrical Limited" (2), usar endpoint oficial /movie/upcoming
    // Este endpoint já retorna filmes na ordem correta e com os filtros aplicados pelo TMDB
    if (releaseType === '3' || releaseType === '2') {
      // Buscar múltiplas páginas se necessário para garantir 20 filmes válidos por página
      const PAGE_SIZE = 20;
      let allFilteredResults = [];
      let currentApiPage = 1;
      const maxApiPages = 10; // Limite de segurança para não fazer muitas requisições
      
      // Buscar páginas até ter filmes suficientes para a página solicitada
      while (allFilteredResults.length < (page * PAGE_SIZE) && currentApiPage <= maxApiPages) {
        const upcomingParams = {
          language: LANGUAGE,
          region: 'US',
          page: currentApiPage.toString(),
        };

        const upcomingData = await callTmdbProxy("movie/upcoming", upcomingParams);

        if (!upcomingData.results || upcomingData.results.length === 0) break;

        // Filtrar por data range se especificado
        let pageResults = upcomingData.results;
        
        if (dateFrom) {
          pageResults = pageResults.filter(m => {
            if (!m.release_date) return false;
            return m.release_date >= dateFrom;
          });
        }
        
        if (dateTo) {
          pageResults = pageResults.filter(m => {
            if (!m.release_date) return false;
            return m.release_date <= dateTo;
          });
        }

        // --- FILTRAGEM semelhante ao TMDB ---
        pageResults = pageResults.filter(m => {
          // Remover filmes sem poster
          if (!m.poster_path) return false;
          // Remover filmes sem release_date
          if (!m.release_date) return false;
          // Remover filmes com release_date inválida
          if (isNaN(Date.parse(m.release_date))) return false;
          // Remover documentários (99) e TV Movies (10770)
          if (Array.isArray(m.genre_ids) && m.genre_ids.some(id => id === 99 || id === 10770)) {
            return false;
          }
          // Manter apenas filmes com idioma original EN (comportamento do TMDB para upcoming global)
          if (m.original_language && m.original_language !== "en") return false;
          return true;
        });

        allFilteredResults = allFilteredResults.concat(pageResults);
        currentApiPage++;
        
        // Se não há mais páginas na API, parar
        if (currentApiPage > (upcomingData.total_pages || 1)) break;
      }

      if (allFilteredResults.length > 0) {
        // Ordenar por data de lançamento ASC (TMDB faz isto)
        allFilteredResults.sort((a, b) => {
          return new Date(a.release_date) - new Date(b.release_date);
        });

        // Paginar corretamente (20 filmes por página)
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginated = allFilteredResults.slice(start, end);

        return {
          results: paginated.map(m => ({
            id: m.id.toString(),
            title: m.title || "Untitled",
            year: m.release_date ? m.release_date.split("-")[0] : "—",
            poster: m.poster_path
              ? `${IMAGE_BASE}${m.poster_path}`
              : "./assets/default.jpg",
            overview: m.overview || "",
            rating: m.vote_average || 0,
          })),
          totalPages: Math.ceil(allFilteredResults.length / PAGE_SIZE),
          currentPage: page,
        };
      }
    }

    // Fallback para discover/movie se /movie/upcoming não devolver resultados suficientes
    const today = dateFrom || new Date().toISOString().split('T')[0];
    const discoverParams = {
      language: LANGUAGE,
      region: 'US',
      page: page.toString(),
      sort_by: 'primary_release_date.asc',
      with_release_type: releaseType,
      'primary_release_date.gte': today,
      without_genres: '99,10770',
      with_original_language: 'en',
    };

    if (dateTo) {
      discoverParams['primary_release_date.lte'] = dateTo;
    }

    const discoverData = await callTmdbProxy("discover/movie", discoverParams);
    
    if (!discoverData.results) return { results: [], totalPages: 0 };

    // --- FILTRAGEM semelhante ao TMDB ---
    let filteredResults = discoverData.results.filter(m => {
      // Remover filmes sem poster
      if (!m.poster_path) return false;
      // Remover filmes sem release_date
      if (!m.release_date) return false;
      // Remover filmes com release_date inválida
      if (isNaN(Date.parse(m.release_date))) return false;
      // Remover documentários (99) e TV Movies (10770)
      if (Array.isArray(m.genre_ids) && m.genre_ids.some(id => id === 99 || id === 10770)) {
        return false;
      }
      // Manter apenas filmes com idioma original EN
      if (m.original_language && m.original_language !== "en") return false;
      return true;
    });

    // Ordenar por data de lançamento ASC (TMDB faz isto)
    filteredResults.sort((a, b) => {
      return new Date(a.release_date) - new Date(b.release_date);
    });

    // Paginar corretamente (20 filmes por página)
    const PAGE_SIZE = 20;
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginated = filteredResults.slice(start, end);

    return {
      results: paginated.map(m => ({
        id: m.id.toString(),
        title: m.title || "Untitled",
        year: m.release_date ? m.release_date.split("-")[0] : "—",
        release_date: m.release_date || null,
        poster: m.poster_path
          ? `${IMAGE_BASE}${m.poster_path}`
          : "./assets/default.jpg",
        overview: m.overview || "",
        rating: m.vote_average || 0,
      })),
      totalPages: Math.ceil(filteredResults.length / PAGE_SIZE),
      currentPage: page,
    };
  } catch (err) {
    console.error("❌ Erro ao obter filmes upcoming:", err);
    return { results: [], totalPages: 0 };
  }
}

// =====================================================
// 🔍 DISCOVER MOVIES (with filters)
// =====================================================
export async function discoverMovies(page = 1, filters = {}) {
  try {
    // Se o filtro upcoming estiver ativo, usar getUpcomingMovies()
    if (filters.upcoming && filters.upcoming.enabled) {
      const dateFrom = filters.upcoming.dateFrom || null;
      const dateTo = filters.upcoming.dateTo || null;
      const releaseType = filters.upcoming.releaseType || '3';
      return await getUpcomingMovies(page, dateFrom, dateTo, releaseType);
    }

    const params = {
      language: LANGUAGE,
      page: page.toString(),
      sort_by: 'popularity.desc',
    };

    const hasGenreFilter = Array.isArray(filters.genres) && filters.genres.length > 0;

    // Remover documentários (99) e TV Movies (10770) em TODOS os cenários
    params.without_genres = '99,10770';

    // Top Rating filter (TMDB-style)
    if (filters.topRating) {
      params.sort_by = 'vote_average.desc';
      // Reforçar qualidade: muitos votos
      params['vote_count.gte'] = '3000';
    }

    // Genre filter
    if (hasGenreFilter) {
      params.with_genres = filters.genres.join(',');
    }

    // Year filter
    if (filters.year) {
      const yearStart = `${filters.year}-01-01`;
      const yearEnd = `${filters.year}-12-31`;
      params['primary_release_date.gte'] = yearStart;
      params['primary_release_date.lte'] = yearEnd;
    }

    // Idioma original EN só quando NÃO há filtro de género
    // (Popular, Top Rating sem género, Year sem género)
    if (!hasGenreFilter) {
      params.with_original_language = 'en';
    }

    const data = await callTmdbProxy("discover/movie", params);
    if (!data.results) return { results: [], totalPages: 0 };

    return {
      results: data.results.map(m => ({
        id: m.id.toString(),
        title: m.title || "Untitled",
        year: m.release_date ? m.release_date.split("-")[0] : "—",
        release_date: m.release_date || null,
        poster: m.poster_path
          ? `${IMAGE_BASE}${m.poster_path}`
          : "./assets/default.jpg",
        overview: m.overview || "",
        rating: m.vote_average || 0,
      })),
      totalPages: data.total_pages || 0,
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao descobrir filmes:", err);
    return { results: [], totalPages: 0 };
  }
}

// =====================================================
// 🔍 SEARCH SERIES
// =====================================================
export async function searchSeries(query, page = 1) {
  try {
    const data = await callTmdbProxy("search/tv", {
      language: LANGUAGE,
      query: encodeURIComponent(query),
      page: page.toString(),
    });
    
    if (!data.results) return { results: [], totalPages: 0, currentPage: 1 };

    return {
      results: data.results.map(s => ({
        id: s.id.toString(),
        title: s.name || "Untitled",
        year: s.first_air_date ? s.first_air_date.split("-")[0] : "—",
        poster: s.poster_path
          ? `${IMAGE_BASE}${s.poster_path}`
          : "./assets/default.jpg",
        overview: s.overview || "",
        rating: s.vote_average || 0,
      })),
      totalPages: Math.min(data.total_pages || 0, 500),
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao pesquisar séries:", err);
    return { results: [], totalPages: 0, currentPage: 1 };
  }
}

// =====================================================
// 📺 SERIES DETAILS
// =====================================================
export async function getSeriesDetails(seriesId) {
  try {
    const data = await callTmdbProxy(`tv/${seriesId}`, {
      language: LANGUAGE,
    });

    const posterPath = data.poster_path || null;
    const backdropPath = data.backdrop_path || null;
    const nextEp = data.next_episode_to_air || null;

    return {
      id: seriesId.toString(),
      title: data.name || "Untitled",
      year: data.first_air_date ? data.first_air_date.split("-")[0] : "—",
      poster: posterPath ? `${IMAGE_BASE}${posterPath}` : "./assets/default.jpg",
      // Paths crus para poder gerar outras resoluções
      posterPath,
      backdropPath,
      description: data.overview || "",
      // Tratar séries "Canceled" como terminadas (Ended) no TV Status
      status:
        data.status === "Ended" || data.status === "Canceled"
          ? "Ended"
          : "On Display",
      genres: (data.genres || []).map((g) => g.name),
      rating: data.vote_average || 0,
      seasons: (data.seasons || [])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          number: s.season_number,
          episodeCount: s.episode_count || 0,
        })),
      // Próximo episódio a ir para o ar (se existir)
      nextEpisode: nextEp
        ? {
            seasonNumber: nextEp.season_number || null,
            episodeNumber: nextEp.episode_number || null,
            air_date: nextEp.air_date || null,
            name: nextEp.name || null,
          }
        : null,
    };
  } catch (err) {
    console.error("❌ Erro ao obter detalhes da série:", err);
    return null;
  }
}

// =====================================================
// 📺 GET SEASON EPISODES
// =====================================================
export async function getSeasonEpisodes(seriesId, seasonNumber) {
  try {
    const data = await callTmdbProxy(`tv/${seriesId}/season/${seasonNumber}`, {
      language: LANGUAGE,
    });
    if (!data.episodes || !Array.isArray(data.episodes)) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas datas

    // Filtrar apenas episódios que já foram ao ar
    const airedEpisodes = data.episodes.filter(ep => {
      if (!ep.air_date) return false; // Sem data de exibição = ainda não foi ao ar
      
      const airDate = new Date(ep.air_date);
      airDate.setHours(0, 0, 0, 0);
      return airDate <= today; // Apenas episódios que já foram ao ar (hoje ou antes)
    });

    // Retornar episódios com título, número e data de lançamento
    return airedEpisodes.map(ep => ({
      number: ep.episode_number || 0, // Número do episódio
      title: ep.name ? `Ep. ${ep.episode_number} - ${ep.name}` : `Episode ${ep.episode_number}`,
      air_date: ep.air_date || null, // Data de lançamento do episódio
    }));
  } catch (err) {
    console.error(`❌ Erro ao carregar episódios da temporada ${seasonNumber}:`, err);
    return [];
  }
}

// =====================================================
// 📺 IMPORT FULL SERIES (with all seasons and episodes)
// =====================================================
export async function importFullSeries(seriesId) {
  try {
    const serie = await getSeriesDetails(seriesId);
    if (!serie || !serie.seasons || serie.seasons.length === 0) {
      if (serie) serie.seasons = [];
      return serie;
    }

    // ✅ MELHORIA: Fazer todas as requisições em PARALELO (muito mais rápido!)
    // getSeriesDetails já filtra temporadas especiais (season_number > 0)
    const seasonPromises = serie.seasons.map(async (s) => {
      try {
        const episodes = await getSeasonEpisodes(seriesId, s.number);
        return {
          number: s.number,
          episodes: episodes || [], // Garantir que sempre é um array
        };
      } catch (err) {
        // ✅ MELHORIA: Se uma temporada falhar, continuar com as outras
        console.warn(`⚠️ Erro ao carregar temporada ${s.number}:`, err);
        return {
          number: s.number,
          episodes: [], // Retornar temporada vazia em vez de falhar tudo
        };
      }
    });

    // Aguardar todas as requisições em paralelo
    const seasonsWithEpisodes = await Promise.all(seasonPromises);
    
    // Ordenar temporadas por número (caso a API não retorne ordenado)
    seasonsWithEpisodes.sort((a, b) => a.number - b.number);

    serie.seasons = seasonsWithEpisodes;
    return serie;
  } catch (err) {
    console.error("❌ Erro ao importar série completa:", err);
    return null;
  }
}

// =====================================================
// 📺 GET POPULAR SERIES (for allseries.html) - aligned with TMDB UI
// =====================================================
export async function getPopularSeries(page = 1) {
  try {
    const params = {
      language: LANGUAGE,
      page: page.toString(),
      sort_by: "popularity.desc",
      without_genres: "99,10770",
      with_original_language: "en",
      "vote_count.gte": "50",
    };

    const data = await callTmdbProxy("discover/tv", params);
    if (!data.results) return { results: [], totalPages: 0 };

    return {
      results: data.results.map((s) => ({
        id: s.id.toString(),
        title: s.name || "Untitled",
        year: s.first_air_date ? s.first_air_date.split("-")[0] : "—",
        poster: s.poster_path
          ? `${IMAGE_BASE}${s.poster_path}`
          : "./assets/default.jpg",
        overview: s.overview || "",
        rating: s.vote_average || 0,
      })),
      totalPages: data.total_pages || 0,
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao obter séries populares:", err);
    return { results: [], totalPages: 0 };
  }
}

// =====================================================
// 📺 GET TV GENRES
// =====================================================
export async function getSeriesGenres() {
  try {
    const data = await callTmdbProxy("genre/tv/list", {
      language: LANGUAGE,
    });
    return data.genres || [];
  } catch (err) {
    console.error("❌ Erro ao obter géneros de séries:", err);
    return [];
  }
}

// =====================================================
// 🔍 DISCOVER SERIES (with filters)
// =====================================================
export async function discoverSeries(page = 1, filters = {}) {
  try {
    const params = {
      language: LANGUAGE,
      page: page.toString(),
      sort_by: "popularity.desc",
    };

    const hasGenreFilter =
      Array.isArray(filters.genres) && filters.genres.length > 0;

    // Remover documentários (99) e TV Movies (10770) em TODOS os cenários
    params.without_genres = "99,10770";

    // Top Rating filter (TMDB-style)
    if (filters.topRating) {
      params.sort_by = "vote_average.desc";
      // Reforçar qualidade: votos suficientes, mas permitir séries mais recentes (ex.: The Pitt)
      params["vote_count.gte"] = "300";
    }

    // Genre filter
    if (hasGenreFilter) {
      params.with_genres = filters.genres.join(",");
    }

    // Year filter
    if (filters.year) {
      const yearStart = `${filters.year}-01-01`;
      const yearEnd = `${filters.year}-12-31`;
      params["first_air_date.gte"] = yearStart;
      params["first_air_date.lte"] = yearEnd;
    }

    // Idioma original EN só quando NÃO há filtro de género NEM topRating
    // (Popular puro, Year sem género). Para Top Rating queremos ranking global.
    if (!hasGenreFilter && !filters.topRating) {
      params.with_original_language = "en";
    }

    const data = await callTmdbProxy("discover/tv", params);
    if (!data.results) return { results: [], totalPages: 0 };

    return {
      results: data.results.map((s) => ({
        id: s.id.toString(),
        title: s.name || "Untitled",
        year: s.first_air_date ? s.first_air_date.split("-")[0] : "—",
        poster: s.poster_path
          ? `${IMAGE_BASE}${s.poster_path}`
          : "./assets/default.jpg",
        overview: s.overview || "",
        rating: s.vote_average || 0,
      })),
      totalPages: data.total_pages || 0,
      currentPage: data.page || 1,
    };
  } catch (err) {
    console.error("❌ Erro ao descobrir séries:", err);
    return { results: [], totalPages: 0 };
  }
}

