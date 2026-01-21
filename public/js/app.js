// src/app.js
// Entry point modular — detecta a página e carrega o módulo correspondente

// ⚡ Capturar beforeinstallprompt o mais cedo possível (antes de qualquer import)
window.pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.pwaInstallPrompt = e;
});

import { protectPage } from "./firebase/auth.js";
import { loadUserPreferences } from "./modules/idioma.js";
import { isGuestMode, isProtectedPage } from "./modules/guestMode.js";
import { renderBottomNav } from "./ui/bottomNav.js";
import { setBadge, initFCM } from "./notifications/index.js";
import { getNotifications } from "./modules/notifications.js";

// Detectar modo standalone (PWA) e adicionar classe ao HTML/body
// Isto garante que estilos móveis aplicam mesmo em ecrãs grandes quando em modo PWA
function detectStandaloneMode() {
  // Múltiplas formas de detetar modo standalone para máxima compatibilidade
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://') ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  
  if (isStandalone) {
    document.documentElement.classList.add('pwa-mode');
    document.body.classList.add('pwa-mode');
    console.log('[PWA] Standalone mode detected - mobile styles will apply');
  }
}

// Detectar imediatamente (antes de tudo carregar)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectStandaloneMode);
} else {
  detectStandaloneMode();
}

// Também verificar periodicamente (fallback caso a detecção inicial falhe)
setTimeout(detectStandaloneMode, 100);
setTimeout(detectStandaloneMode, 500);

// Evita misturar com outras implementações antigas: usamos apenas a modular app
function getPageName() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  return file.replace(".html", "");
}

// Garante que o favicon correto está sempre presente (apenas .ico para máxima compatibilidade)
// IMPORTANTE: Só altera o favicon em páginas de séries. Para todas as outras páginas, retorna imediatamente
// sem tocar no DOM, deixando o favicon estático do HTML intacto para o Firefox capturar corretamente
function setFavicon() {
  if (!document.head) return;
  
  const page = getPageName();
  // Usar apenas .ico - azul para filmes, verde para séries
  const isSeriesPage = page === "series" || page === "serie" || page === "allseries" || page === "allserie";
  
  // Se NÃO for página de séries, retorna imediatamente sem fazer NADA
  // Isso garante que o favicon estático do HTML fica intacto para o Firefox
  if (!isSeriesPage) {
    return;
  }
  
  // Só chega aqui se for página de séries - mudar para verde
  const faviconPath = "/favicons/favicon-green.ico";
  
  // Encontra o favicon existente no HTML
  let faviconIco = document.querySelector('link[rel="icon"][href*="favicon"]');
  
  // Se o favicon já existe e está correto, não fazer nada
  if (faviconIco) {
    const currentHref = faviconIco.getAttribute("href");
    if (currentHref && (currentHref === faviconPath || currentHref.endsWith(faviconPath))) {
      // Favicon já está correto, não alterar
      return;
    }
  }
  
  // Só altera se não existir ou se estiver incorreto
  if (!faviconIco) {
    // Se não existir, cria e adiciona
    faviconIco = document.createElement("link");
    faviconIco.rel = "icon";
    faviconIco.type = "image/x-icon";
    faviconIco.setAttribute("sizes", "any");
    document.head.insertBefore(faviconIco, document.head.firstChild);
  }
  
  // Atualiza o href apenas se necessário (NÃO mover no DOM)
  faviconIco.setAttribute("href", faviconPath);
  
  // Atualiza shortcut icon
  let shortcut = document.querySelector('link[rel="shortcut icon"]');
  if (!shortcut) {
    shortcut = document.createElement("link");
    shortcut.rel = "shortcut icon";
    shortcut.type = "image/x-icon";
    document.head.appendChild(shortcut);
  }
  shortcut.setAttribute("href", faviconPath);
}

async function bootstrap() {
  const page = getPageName();

  // Só define o favicon se for página de séries (para mudar para verde)
  // Na página Home e outras páginas de filmes, deixa o HTML estático fazer o trabalho
  // Isso evita interferir com a captura do favicon pelo Firefox para bookmarks
  if (page === "series" || page === "serie" || page === "allseries" || page === "allserie") {
  setFavicon();
  }
  // Para todas as outras páginas, NÃO chamar setFavicon() - deixa o HTML estático

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

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/pwa/service-worker.js')
      .then((registration) => {
        // Verificar atualizações periodicamente
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[Service Worker] Registration failed:', error);
      });
  });
}

// Inicializar Badge API e FCM
async function initNotifications() {
  // Inicializar FCM (Push Notifications)
  try {
    await initFCM();
  } catch (err) {
    console.warn('Failed to initialize FCM:', err);
  }
  
  // Atualizar Badge API quando notificações mudarem
  const updateBadge = async () => {
    try {
      const list = await getNotifications();
      const unreadCount = list.filter(n => !n.read).length;
      await setBadge(unreadCount);
    } catch (err) {
      console.warn('Failed to update badge:', err);
    }
  };
  
  // Atualizar badge inicialmente
  updateBadge();
  
  // Escutar eventos de atualização de notificações
  document.addEventListener("notificationsUpdated", updateBadge);
  document.addEventListener("notificationsSynced", updateBadge);
}

window.addEventListener("DOMContentLoaded", async () => {
  setFavicon();
  renderBottomNav(); // Renderizar bottom navigation para app mode
  initNotifications(); // Inicializar Badge API e FCM
  
  // Verificar lançamentos de filmes e séries em todas as páginas
  // Executar após um pequeno delay para garantir que tudo está carregado
  setTimeout(async () => {
    try {
      const { checkMovieReleases } = await import("./modules/movies/followingMovies.js");
      const { checkSeriesReleases } = await import("./modules/series/followingSeries.js");
      await checkMovieReleases();
      await checkSeriesReleases();
    } catch (err) {
      console.warn("Failed to check movie/series releases:", err);
    }
  }, 1000);
  
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

// Atualiza favicon dinâmico periodicamente (a cada 2 segundos) para garantir que está sempre presente
setInterval(() => {
  const dynamicFavicon = document.querySelector('link[rel="icon"][data-dynamic="true"]');
  if (!dynamicFavicon || !dynamicFavicon.href.includes('data:image')) {
    setFavicon();
  }
}, 2000);
