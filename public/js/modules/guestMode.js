// src/modules/guestMode.js
// ===============================
// Guest Mode / Demo Mode
// ===============================
// Gerencia o modo convidado sem criar utilizadores anónimos no Firebase

const GUEST_MODE_KEY = "guest_mode_active";
const GUEST_CODE_KEY = "guest_access_code"; // Para validação futura se necessário

// ✅ GUEST_ACCESS_CODE removido - agora validado no backend via Firebase Functions

// Verifica se está em modo convidado
export function isGuestMode() {
  return sessionStorage.getItem(GUEST_MODE_KEY) === "true";
}

// Ativa o modo convidado
export function enableGuestMode() {
  // Limpar TODOS os dados antigos primeiro (incluindo dados de filmes/séries antigos)
  clearGuestData();
  // Ativar modo convidado
  sessionStorage.setItem(GUEST_MODE_KEY, "true");
  // Carregar dados default
  loadGuestDefaultData();
}

// Desativa o modo convidado e limpa todos os dados
export function disableGuestMode() {
  sessionStorage.removeItem(GUEST_MODE_KEY);
  clearGuestData();
}

// Limpa todos os dados do modo convidado do sessionStorage
export function clearGuestData() {
  const keysToRemove = [
    "movies",
    "movies_order",
    "movies_progress",
    "series",
    "series_order",
    "series_progress",
    "notifications",
    GUEST_MODE_KEY
  ];
  
  keysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
  });
  
  // Limpar também qualquer cache de sincronização
  sessionStorage.removeItem("movies_sync_cache");
  sessionStorage.removeItem("series_sync_cache");
  
  console.log("✅ Dados do modo convidado limpos");
}

// Dados default para demonstração
const DEFAULT_MOVIES = [
  {
    id: "m1",
    title: "The Matrix",
    year: 1999,
    poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    tmdbId: 603,
    addedAt: new Date().toISOString()
  },
  {
    id: "m2",
    title: "Top Gun: Maverick",
    year: 2022,
    poster: "https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
    tmdbId: 361743,
    addedAt: new Date().toISOString()
  },
  {
    id: "m3",
    title: "Spider-Man: No Way Home",
    year: 2021,
    poster: "https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
    tmdbId: 634649,
    addedAt: new Date().toISOString()
  },
  {
    id: "m4",
    title: "The Avengers",
    year: 2012,
    poster: "https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg",
    tmdbId: 24428,
    addedAt: new Date().toISOString()
  },
  {
    id: "m5",
    title: "The Dark Knight",
    year: 2008,
    poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    tmdbId: 155,
    addedAt: new Date().toISOString()
  },
  {
    id: "m6",
    title: "Dune",
    year: 2021,
    poster: "https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    tmdbId: 438631,
    addedAt: new Date().toISOString()
  }
];

const DEFAULT_SERIES = [
  {
    id: "s1",
    title: "Breaking Bad",
    year: 2008,
    poster: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
    tmdbId: 1396,
    addedAt: new Date().toISOString()
  },
  {
    id: "s2",
    title: "House",
    year: 2004,
    poster: "https://image.tmdb.org/t/p/w500/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg",
    tmdbId: 1408,
    addedAt: new Date().toISOString()
  },
  {
    id: "s3",
    title: "Chernobyl",
    year: 2019,
    poster: "https://image.tmdb.org/t/p/w500/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
    tmdbId: 87108,
    addedAt: new Date().toISOString()
  },
  {
    id: "s4",
    title: "Game of Thrones",
    year: 2011,
    poster: "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
    tmdbId: 1399,
    addedAt: new Date().toISOString()
  },
  {
    id: "s5",
    title: "Stranger Things",
    year: 2016,
    poster: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    tmdbId: 66732,
    addedAt: new Date().toISOString()
  },
  {
    id: "s6",
    title: "Suits",
    year: 2011,
    poster: "https://image.tmdb.org/t/p/w500/vQiryp6LioFxQThywxbC6TuoDjy.jpg",
    tmdbId: 37680,
    addedAt: new Date().toISOString()
  }
];

// Carrega dados default no sessionStorage
function loadGuestDefaultData() {
  try {
    // Limpar dados antigos primeiro
    sessionStorage.removeItem("movies");
    sessionStorage.removeItem("movies_order");
    sessionStorage.removeItem("movies_progress");
    sessionStorage.removeItem("series");
    sessionStorage.removeItem("series_order");
    sessionStorage.removeItem("series_progress");
    sessionStorage.removeItem("notifications");
    
    // Filmes
    sessionStorage.setItem("movies", JSON.stringify(DEFAULT_MOVIES));
    sessionStorage.setItem("movies_order", JSON.stringify(DEFAULT_MOVIES.map(m => m.id)));
    sessionStorage.setItem("movies_progress", JSON.stringify({}));
    
    // Séries
    sessionStorage.setItem("series", JSON.stringify(DEFAULT_SERIES));
    sessionStorage.setItem("series_order", JSON.stringify(DEFAULT_SERIES.map(s => s.id)));
    sessionStorage.setItem("series_progress", JSON.stringify({}));
    
    // Notificações vazias
    sessionStorage.setItem("notifications", JSON.stringify([]));
    
    console.log("✅ Dados default do modo convidado carregados");
  } catch (err) {
    console.error("❌ Erro ao carregar dados default do modo convidado:", err);
  }
}

// Verifica se uma página é protegida (não acessível em modo convidado)
export function isProtectedPage(pageName) {
  const protectedPages = ["settings"];
  return protectedPages.includes(pageName);
}

// Service para sessionStorage (similar ao storageService mas para sessionStorage)
export const guestStorageService = {
  async get(key, fallback = null) {
    if (!isGuestMode()) {
      return fallback;
    }
    try {
      const res = sessionStorage.getItem(key);
      if (!res) return fallback;
      return JSON.parse(res);
    } catch (err) {
      console.error("❌ guestStorageService.get ERROR:", err);
      return fallback;
    }
  },

  async set(key, value) {
    if (!isGuestMode()) {
      return false;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("❌ guestStorageService.set ERROR:", err);
      return false;
    }
  },

  async remove(key) {
    if (!isGuestMode()) {
      return false;
    }
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error("❌ guestStorageService.remove ERROR:", err);
      return false;
    }
  }
};

