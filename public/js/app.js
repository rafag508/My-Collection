// src/app.js
// Entry point modular — detecta a página e carrega o módulo correspondente

import { protectPage } from "./firebase/auth.js";
import { loadUserPreferences } from "./modules/idioma.js";
import { isGuestMode, isProtectedPage } from "./modules/guestMode.js";

// Evita misturar com outras implementações antigas: usamos apenas a modular app
function getPageName() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  return file.replace(".html", "");
}

// Garante que o favicon correto está sempre presente
function setFavicon() {
  if (!document.head) return;
  
  const page = getPageName();
  let iconPath = "assets/mc-icon-blue.svg";
  let iconColor = "#2563eb";
  
  if (page === "series" || page === "serie" || page === "allseries") {
    iconPath = "assets/mc-icon-green.svg";
    iconColor = "#16a34a";
  }
  
  // Atualiza favicons existentes em vez de remover
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  
  // Cria PNG usando canvas
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  
  if (ctx) {
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(64 - radius, 0);
    ctx.quadraticCurveTo(64, 0, 64, radius);
    ctx.lineTo(64, 64 - radius);
    ctx.quadraticCurveTo(64, 64, 64 - radius, 64);
    ctx.lineTo(radius, 64);
    ctx.quadraticCurveTo(0, 64, 0, 64 - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    
    ctx.fillStyle = iconColor;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MC", 32, 32);
    
    // Usa PNG como principal
    favicon.type = "image/png";
    favicon.href = canvas.toDataURL("image/png");
  } else {
    // Fallback para SVG se canvas não funcionar
    favicon.type = "image/svg+xml";
    favicon.href = iconPath + "?v=" + Date.now();
  }
  
  // Atualiza shortcut icon também
  let shortcut = document.querySelector('link[rel="shortcut icon"]');
  if (!shortcut) {
    shortcut = document.createElement("link");
    shortcut.rel = "shortcut icon";
    document.head.appendChild(shortcut);
  }
  shortcut.href = favicon.href;
}

async function bootstrap() {
  const page = getPageName();

  // Define o favicon correto imediatamente
  setFavicon();

  // Detecta refresh (F5) - método compatível com browsers modernos
  // Se for refresh, limpar flag de notificações para permitir nova sync
  // (as notificações são carregadas no navbar que é renderizado em todas as páginas)
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const isRefresh = navigationEntry?.type === 'reload' || (performance.navigation && performance.navigation.type === 1);
  if (isRefresh) {
    sessionStorage.removeItem("hasSyncedNotificationsFromFirestoreOnce");
  }

  // Verificar se está em modo convidado e tentar aceder a página protegida
  if (isGuestMode() && isProtectedPage(page)) {
    alert("O modo convidado não tem acesso a esta página. Por favor, cria uma conta para aceder às definições.");
    window.location.href = "./index.html";
    return;
  }

  // Espera até o auth estar pronto (evita erros por UID ausente)
  try {
    await protectPage();
    // Carregar preferências do utilizador (idioma, etc.)
    // Em modo convidado, será definido como inglês automaticamente
    await loadUserPreferences();
  } catch (err) {
    console.error("Erro durante protectPage():", err);
    // se der erro no auth deixamos continuar (p.ex. login page) — mas logamos para debug
    // Tentar carregar preferências mesmo assim (pode haver localStorage)
    try {
      await loadUserPreferences();
    } catch (e) {
      console.warn("Could not load user preferences:", e);
    }
  }

  try {
    switch (page) {
      case "":
      case "index":
        (await import("./pages/indexPage.js")).initIndexPage();
        break;
      case "movies":
        (await import("./pages/movies/moviesPage.js")).initMoviesPage();
        break;
      case "series":
        (await import("./pages/series/seriesPage.js")).initSeriesPage();
        break;
      case "serie":
        (await import("./pages/series/seriePage.js")).initSeriePage();
        break;
        case "movie":
        (await import("./pages/movies/moviePage.js")).initMoviePage();
        break;
      case "login":
        (await import("./pages/loginPage.js"));
        break;
      case "notifications":                // ✅ add this
        (await import("./pages/notificationsPage.js")).initNotificationsPage();
        break;
      case "stats":
        (await import("./pages/statsPage.js")).initStatsPage();
        break;
      case "allmovies":
        (await import("./pages/allmovies/allmoviesPage.js")).initAllMoviesPage();
        break;
      case "allmovie":
        (await import("./pages/allmovies/allmoviePage.js")).initAllMoviePage();
        break;
      case "allseries":
        (await import("./pages/allseries/allseriesPage.js")).initAllSeriesPage();
        break;
      case "allserie":
        (await import("./pages/allseries/allseriePage.js")).initAllSeriePage();
        break;
      case "search":
        (await import("./pages/search/searchPage.js")).initSearchPage();
        break;
      case "settings":
        // Verificar novamente antes de inicializar (segurança extra)
        if (isGuestMode()) {
          alert("O modo convidado não tem acesso às definições. Por favor, cria uma conta.");
          window.location.href = "./index.html";
          return;
        }
        (await import("./pages/settingsPage.js")).initSettingsPage();
        break;
      default:
        console.warn("Página desconhecida:", page);
    }
  } catch (err) {
    console.error("Erro ao inicializar página:", err);
  }
}

// Define favicon imediatamente (antes do DOM estar pronto)
if (document.head) {
  setFavicon();
}

// Intercepta navegação para atualizar favicon antes de mudar de página
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setFavicon();
  }
}).observe(document, { subtree: true, childList: true });

window.addEventListener("DOMContentLoaded", () => {
  setFavicon();
  bootstrap();
});

// Reforça o favicon quando a página está totalmente carregada
window.addEventListener("load", () => {
  setFavicon();
  // Reforça novamente após um pequeno delay
  setTimeout(setFavicon, 200);
});

// Atualiza favicon quando a página ganha foco novamente (útil quando volta de outra aba)
window.addEventListener("focus", () => {
  setFavicon();
  setTimeout(setFavicon, 100);
});

// Atualiza favicon quando a visibilidade da página muda
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setFavicon();
    setTimeout(setFavicon, 100);
  }
});

// Atualiza favicon periodicamente (a cada 2 segundos) para garantir que está sempre presente
setInterval(() => {
  const currentFavicon = document.querySelector('link[rel="icon"]');
  if (!currentFavicon || !currentFavicon.href.includes('data:image')) {
    setFavicon();
  }
}, 2000);
