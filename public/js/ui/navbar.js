import { logout, getCurrentUser, getCurrentUID, login } from "../firebase/auth.js";
import { register } from "../firebase/auth.js";
import { getNotifications } from "../modules/notifications.js";
import { t as translate } from "../modules/idioma.js";
import { getUserPreferencesFirestore } from "../firebase/firestore.js";
import { isGuestMode, disableGuestMode } from "../modules/guestMode.js";

// ✅ Import dinâmico do módulo PWA (para compatibilidade com Firefox)
let initInstallButton, setupInstallPrompt, isInstalled;
let pwaModuleLoaded = false;

// Carregar módulo PWA dinamicamente
(async () => {
  try {
    const pwaModule = await import("../modules/pwaInstall.js");
    initInstallButton = pwaModule.initInstallButton;
    setupInstallPrompt = pwaModule.setupInstallPrompt;
    isInstalled = pwaModule.isInstalled;
    pwaModuleLoaded = true;
  } catch (error) {
    console.error('[PWA] Navbar: Failed to load module:', error);
    pwaModuleLoaded = false;
  }
})();

// src/ui/navbar.js
export function renderNavbar() {
  const container = document.getElementById("navbar");
  if (!container) return;

  const currentPage = window.location.pathname.split("/").pop();
  
  // Verificar se veio de allmovies ou allseries
  const params = new URLSearchParams(window.location.search);
  const fromAllMovies = params.get("from") === "allmovies";
  const fromAllSeries = params.get("from") === "allseries";

  let iconColor = "bg-blue-600";
  if (currentPage === "series.html" || currentPage === "serie.html") {
    iconColor = "bg-green-600";
  }

  let searchPlaceholder = translate("search");
  if (currentPage === "movies.html") searchPlaceholder = translate("searchMovies");
  else if (currentPage === "series.html") searchPlaceholder = translate("searchSeries");

  const showSearch = currentPage !== "serie.html";
  const showTitle = currentPage !== "serie.html";
  
  // Determinar cor do botão "More" baseado na origem
  let moreButtonColor = "hover:text-blue-400";
  if (fromAllMovies || currentPage === "allmovies.html" || currentPage === "allmovie.html") {
    moreButtonColor = "text-blue-400";
  } else if (fromAllSeries || currentPage === "allseries.html" || currentPage === "allserie.html") {
    moreButtonColor = "text-green-400";
  }

  // Verificar se está em modo convidado
  const guestMode = isGuestMode();

  container.innerHTML = `
  ${guestMode ? `
  <!-- Aviso de Modo Convidado -->
  <div class="sticky top-0 z-50 bg-yellow-600/90 backdrop-blur border-b border-yellow-500/30">
    <div class="max-w-[1600px] mx-auto px-4 py-2 text-center">
      <p class="text-sm font-semibold text-yellow-900">
        ⚠️ ${translate('guestModeWarning')}
      </p>
    </div>
  </div>
  ` : ""}
  <header class="sticky ${guestMode ? 'top-[42px]' : 'top-0'} z-40 backdrop-blur bg-black/60 border-b border-white/5 relative">
    <div class="max-w-[1600px] mx-auto flex items-center justify-between p-4">

      <!-- LEFT SIDE -->
      <div class="flex items-center gap-6">
        <a href="index.html" class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg ${iconColor} grid place-items-center font-extrabold text-white">
            MC
          </div>
          ${
            showTitle
              ? `<span class="font-extrabold tracking-tight text-lg">${translate('myCollection')}</span>`
              : ""
          }
        </a>

        <nav class="hidden md:flex items-center gap-4 text-sm font-semibold">
          <a href="index.html"
             class="hover:text-blue-400 ${currentPage === "index.html" ? "text-blue-400" : ""}">
            ${translate("home")}
          </a>
          <a href="movies.html"
             class="hover:text-blue-400 ${(currentPage === "movies.html" || (currentPage === "movie.html" && !fromAllMovies && currentPage !== "allmovie.html")) ? "text-blue-400" : ""}">
            ${translate("movies")}
          </a>
          <a href="series.html"
             class="hover:text-green-400 ${(currentPage === "series.html" || (currentPage === "serie.html" && !fromAllSeries && currentPage !== "allserie.html")) ? "text-green-400" : ""}">
            ${translate("tvShows")}
          </a>

          <!-- More dropdown -->
          <div class="relative group">
            <button class="${moreButtonColor}">${translate("more")}</button>
            <div class="absolute left-1/2 -translate-x-1/4 top-full mt-8 w-32 bg-gray-900 border border-white/10 rounded-lg shadow-lg py-1 text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <a href="allmovies.html${currentPage === "allmovie.html" ? "?page=1" : ""}" class="block px-3 py-2 hover:bg-gray-800">
                ${translate("movies")}
              </a>
              <a href="allseries.html${currentPage === "allserie.html" ? "?page=1" : ""}" class="block px-3 py-2 hover:bg-gray-800">
                ${translate("tvShows")}
              </a>
            </div>
          </div>
        </nav>
      </div>

      <!-- CENTER: Create Collection Text (only in guest mode) -->
      ${guestMode ? `
      <div class="hidden md:flex items-center justify-end flex-1 pr-8">
        <p class="text-lg font-semibold text-gray-300">
          Create your own collection <button id="createAccountFromNavbarBtn" class="text-green-400 text-2xl font-extrabold hover:text-green-300 transition-colors cursor-pointer underline ml-6">NOW</button>
        </p>
      </div>
      ` : ""}

      <!-- RIGHT SIDE: only the search bar -->
<div class="flex items-center gap-4 flex-1 justify-end">

      <!-- SEARCH BAR - stays where you want -->
  ${ 
    showSearch
      ? `
      <div class="hidden md:block mr-6">
        <label class="relative w-72">
          <input id="search" type="search" placeholder="${searchPlaceholder}"
            class="w-full rounded-xl bg-white/5 pl-10 pr-3 py-2 outline-none ring-0 focus:bg-white/10 placeholder:text-gray-400 transition-all duration-200" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </label>
      </div>
      `
      : ""
  }

</div>

<!-- BUTTONS: move them outside and fully right-aligned -->
<div class="hidden md:flex items-center gap-3">

  <!-- Bell -->
  <button
    id="notificationsBell"
    class="relative h-8 w-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white grid place-items-center text-lg"
  >
    🔔
    <span
      id="notificationsBellBadge"
      class="hidden absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[10px] leading-4 text-center font-semibold"
    >
      0
    </span>
  </button>

  <!-- Profile -->
  <button
    id="profileMenuButton"
    class="h-8 w-8 rounded-lg font-extrabold text-white grid place-items-center focus:outline-none focus:ring-2 bg-cyan-500 overflow-hidden"
  >
    <svg id="profileButtonContent" class="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Cabeça -->
      <circle cx="12" cy="9" r="4" fill="currentColor"/>
      <!-- Ombros/Corpo -->
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6H6z" fill="currentColor"/>
    </svg>
  </button>

  <!-- Dropdown -->
  <div
    id="profileMenu"
    class="absolute right-6 top-full mt-5 w-40 bg-gray-900 border border-white/10 rounded-lg shadow-lg py-1 text-sm hidden"
  >
    <button
      class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800"
      data-profile-action="stats"
    >
      <span>${translate("stats")}</span>
    </button>
    <button
      class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800"
      data-profile-action="notifications"
    >
      <span>${translate("notifications")}</span>
      <span id="notificationsMenuBadge"
        class="hidden ml-2 rounded-full bg-red-500 text-[10px] px-1.5 py-[1px] font-semibold">
        0
      </span>
    </button>
    <button
      id="settingsMenuItem"
      class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800"
      data-profile-action="settings"
    >
      <span>${translate("settings")}</span>
    </button>
    
    <!-- Install App Button (PWA) -->
    <button
      id="installAppBtn"
      class="hidden w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 text-blue-400"
      title="${translate('installApp')}"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span>${translate('installApp')}</span>
    </button>
    
    <button
      class="w-full text-left px-3 py-2 text-red-400 hover:bg-red-900/30"
      data-profile-action="logout"
    >
      ${translate("logout")}
    </button>
  </div>
 </div>
  </header>
`;


  // Elements
  const profileBtn = container.querySelector("#profileMenuButton");
  const profileMenu = container.querySelector("#profileMenu");
  const profileButtonContent = container.querySelector("#profileButtonContent");
  const bellBtn = container.querySelector("#notificationsBell");
  const bellBadge = container.querySelector("#notificationsBellBadge");
  const menuBadge = container.querySelector("#notificationsMenuBadge");
  const installBtn = container.querySelector("#installAppBtn");
  
  // Inicializar PWA Install Button (só se não for guest mode)
  if (!guestMode && installBtn) {
    // Função para inicializar o botão PWA (aguarda carregamento do módulo se necessário)
    const initPWAButton = async () => {
      // Se o módulo ainda não foi carregado, tentar carregar agora
      if (!pwaModuleLoaded) {
        try {
          const pwaModule = await import("../modules/pwaInstall.js");
          initInstallButton = pwaModule.initInstallButton;
          setupInstallPrompt = pwaModule.setupInstallPrompt;
          isInstalled = pwaModule.isInstalled;
          pwaModuleLoaded = true;
        } catch (error) {
          console.error('[PWA] Failed to load module:', error);
          return;
        }
      }
      
      // Verificar se as funções estão disponíveis
      if (typeof initInstallButton === 'function' && typeof setupInstallPrompt === 'function') {
        try {
          // Inicializar o botão primeiro
          initInstallButton(installBtn);
          // Depois configurar o prompt
          setupInstallPrompt();
        } catch (error) {
          console.error('[PWA] Error initializing install button:', error);
        }
      } else {
        console.error('[PWA] Functions not available');
      }
    };
    
    // Inicializar (pode ser assíncrono)
    initPWAButton().catch(error => {
      console.error('[PWA] Unhandled error in initPWAButton:', error);
    });
  } else if (installBtn) {
    // Esconder botão em modo convidado
    installBtn.style.display = 'none';
  }
  
  // Verificar se o utilizador é anónimo ou está em modo convidado
  const currentUser = getCurrentUser();
  const settingsMenuItem = container.querySelector("#settingsMenuItem");
  
  // Esconder Settings se estiver em modo convidado
  if (guestMode && settingsMenuItem) {
    settingsMenuItem.style.display = "none";
  }
  
  // Aplicar cor e letra personalizadas (se não for anónimo nem convidado)
  if (profileBtn && !guestMode && !(currentUser && currentUser.isAnonymous)) {
    // Carregar preferências do Firestore ou localStorage
    (async () => {
      let savedColor = 'cyan';
      let savedLetter = 'R';
      const uid = getCurrentUID();
      
      if (uid) {
        try {
          const prefs = await getUserPreferencesFirestore();
          if (prefs) {
            savedColor = prefs.profileButtonColor || 'cyan';
            savedLetter = prefs.profileButtonLetter || 'R';
          } else {
            // Fallback para localStorage
            savedColor = localStorage.getItem('profileButtonColor') || 'cyan';
            savedLetter = localStorage.getItem('profileButtonLetter') || 'R';
          }
        } catch (err) {
          console.warn("Could not load profile preferences from Firestore:", err);
          savedColor = localStorage.getItem('profileButtonColor') || 'cyan';
          savedLetter = localStorage.getItem('profileButtonLetter') || 'R';
        }
      } else {
        savedColor = localStorage.getItem('profileButtonColor') || 'cyan';
        savedLetter = localStorage.getItem('profileButtonLetter') || 'R';
      }
      
      // Atualizar cor
      const colorMap = {
        cyan: '#06b6d4',
        blue: '#3b82f6',
        green: '#10b981',
        purple: '#a855f7',
        pink: '#ec4899',
        red: '#ef4444',
        orange: '#f97316',
        yellow: '#eab308',
        indigo: '#6366f1',
        teal: '#14b8a6',
        gray: '#6b7280'
      };
      profileBtn.style.backgroundColor = colorMap[savedColor] || colorMap.cyan;
      profileBtn.style.setProperty('--tw-ring-color', colorMap[savedColor] || colorMap.cyan);
      
      // Substituir o SVG pela letra inicial
      if (profileButtonContent) {
        profileButtonContent.remove();
        profileBtn.textContent = savedLetter.toUpperCase();
        profileBtn.style.fontSize = '16px';
        profileBtn.style.fontWeight = '800';
      }
    })();
  }
  
  // Em modo convidado, manter o ícone SVG genérico (já está no HTML)
  
  // O botão de perfil agora sempre mostra o ícone SVG (não precisa de lógica especial para anónimos)
  if (currentUser && currentUser.isAnonymous) {
    // Esconder Settings do menu para utilizadores anónimos
    if (settingsMenuItem) {
      settingsMenuItem.style.display = "none";
    }
  }

  // Bell → notifications page
  if (bellBtn) {
    bellBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearFilters();
      window.location.href = "./notifications.html";
    });
  }

  // Função para atualizar contador de notificações não lidas
  async function updateNotificationBadges() {
    try {
      const list = await getNotifications();
      // Contar apenas notificações não lidas
      const unreadCount = list.filter(n => !n.read).length;
      const show = unreadCount > 0;
      const text = String(unreadCount);

      if (bellBadge) {
        bellBadge.textContent = text;
        bellBadge.classList.toggle("hidden", !show);
      }
      if (menuBadge) {
        menuBadge.textContent = text;
        menuBadge.classList.toggle("hidden", !show);
      }
    } catch (err) {
      console.warn("Failed to load notifications count:", err);
    }
  }

  // Load notifications count and update badges
  updateNotificationBadges();

  // Atualizar contador quando notificações mudarem
  document.addEventListener("notificationsUpdated", () => {
    updateNotificationBadges();
  });

  document.addEventListener("notificationsSynced", () => {
    updateNotificationBadges();
  });

  // Dropdown behavior for profile menu
  if (profileBtn && profileMenu) {
    // Toggle on button click
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
    });

    // Close when clicking outside
    document.addEventListener("click", () => {
      profileMenu.classList.add("hidden");
    });

    // Prevent closing when clicking inside the menu
    profileMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Actions for profile menu
    profileMenu.querySelectorAll("[data-profile-action]").forEach((item) => {
      item.addEventListener("click", (e) => {
        const action = e.currentTarget.getAttribute("data-profile-action");

        // Limpar filtros antes de qualquer ação
        clearFilters();

        if (action === "stats") {
          window.location.href = "./stats.html";
        } else if (action === "notifications") {
          window.location.href = "./notifications.html";
        } else if (action === "settings") {
          // Bloquear acesso a settings em modo convidado
          if (isGuestMode()) {
            alert("O modo convidado não tem acesso às definições. Por favor, cria uma conta.");
            return;
          }
          window.location.href = "./settings.html";
        } else if (action === "logout") {
          logout()
            .catch(err => console.error("Logout error:", err))
            .finally(() => {
              window.location.href = "./login.html";
            });
        }

        profileMenu.classList.add("hidden");
      });
    });
  }
  
  // Listener para mudanças de idioma - re-renderizar navbar
  document.addEventListener("languageChanged", () => {
    renderNavbar();
  });

  // Função para limpar filtros salvos
  function clearFilters() {
    sessionStorage.removeItem('allmoviesFilters');
    sessionStorage.removeItem('allmoviesPage');
    sessionStorage.removeItem('allmoviesFromCard');
    // Filtros da página de filmes (coleção local)
    sessionStorage.removeItem('moviesFilters');
    sessionStorage.removeItem('moviesPage');
    sessionStorage.removeItem('moviesFromCard');
    sessionStorage.removeItem('moviesIsFilterMode');
    sessionStorage.removeItem('allseriesFilters');
    sessionStorage.removeItem('allseriesPage');
    sessionStorage.removeItem('allseriesFromCard');
    // Filtros da página de séries (coleção local)
    sessionStorage.removeItem('seriesFilters');
    sessionStorage.removeItem('seriesPage');
    sessionStorage.removeItem('seriesFromCard');
    sessionStorage.removeItem('seriesIsFilterMode');
  }

  // Adicionar listeners para limpar filtros quando clicar nos links da navbar
  // Home link (logo e texto)
  const homeLinks = container.querySelectorAll('a[href="index.html"]');
  homeLinks.forEach(link => {
    link.addEventListener('click', () => {
      clearFilters();
    });
  });

  // Movies link
  const moviesLink = container.querySelector('a[href="movies.html"]');
  if (moviesLink) {
    moviesLink.addEventListener('click', () => {
      clearFilters();
    });
  }

  // Series/TV Shows link
  const seriesLink = container.querySelector('a[href="series.html"]');
  if (seriesLink) {
    seriesLink.addEventListener('click', () => {
      clearFilters();
    });
  }

  // More Movies link (no dropdown)
  const moreMoviesLink = container.querySelector('a[href*="allmovies.html"]');
  if (moreMoviesLink) {
    moreMoviesLink.addEventListener('click', () => {
      clearFilters();
    });
  }

  // More TV Shows link (no dropdown)
  const moreSeriesLink = container.querySelector('a[href*="allseries.html"]');
  if (moreSeriesLink) {
    moreSeriesLink.addEventListener('click', () => {
      clearFilters();
    });
  }

  // Setup modal de criar conta (apenas em modo convidado)
  if (guestMode) {
    // Adicionar modal ao body se não existir
    let modal = document.getElementById("navbarCreateAccountModal");
    if (!modal) {
      const modalHTML = `
        <div id="navbarCreateAccountModal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div class="w-full max-w-sm bg-gray-900/95 backdrop-blur-xl shadow-xl rounded-2xl p-8 border border-white/10 mx-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-extrabold">Sign up</h2>
              <button
                id="navbarCloseModalBtn"
                type="button"
                class="text-gray-400 hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <form id="navbarCreateAccountForm" class="space-y-4">
              <div id="navbarCreateAccountErrorMsg" class="hidden text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg p-2"></div>

              <div>
                <label class="text-sm font-semibold">Email</label>
                <input
                  id="navbarRegisterEmail"
                  type="email"
                  class="w-full bg-gray-800 mt-1 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label class="text-sm font-semibold">Password</label>
                <div class="relative">
                  <input
                    id="navbarRegisterPassword"
                    type="password"
                    class="w-full bg-gray-800 mt-1 p-3 pr-10 rounded-lg border border-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="••••••"
                    required
                  />
                  <button
                    type="button"
                    id="navbarToggleRegisterPassword"
                    class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none">
                    <svg id="navbarEyeIconRegister" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    <svg id="navbarEyeOffIconRegister" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-sm font-semibold">Secret Code</label>
                <input
                  id="navbarSecretCode"
                  type="text"
                  class="w-full bg-gray-800 mt-1 p-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Enter the secret code"
                  required
                />
              </div>

              <button
                type="submit"
                class="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-all">
                Sign up
              </button>
            </form>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    setupCreateAccountModal();
  }
}

// Função para configurar o modal de criar conta no navbar
function setupCreateAccountModal() {
  const SECRET_CODE = "TheCollection_25!";
  
  const createAccountBtn = document.getElementById("createAccountFromNavbarBtn");
  const createAccountModal = document.getElementById("navbarCreateAccountModal");
  const closeModalBtn = document.getElementById("navbarCloseModalBtn");
  const createAccountForm = document.getElementById("navbarCreateAccountForm");
  const createAccountErrorMsg = document.getElementById("navbarCreateAccountErrorMsg");
  const togglePasswordBtn = document.getElementById("navbarToggleRegisterPassword");
  const registerPasswordInput = document.getElementById("navbarRegisterPassword");
  const eyeIconRegister = document.getElementById("navbarEyeIconRegister");
  const eyeOffIconRegister = document.getElementById("navbarEyeOffIconRegister");

  // Abrir modal
  if (createAccountBtn && createAccountModal) {
    createAccountBtn.addEventListener("click", () => {
      createAccountModal.classList.remove("hidden");
      // Limpar campos ao abrir
      if (createAccountForm) createAccountForm.reset();
      if (createAccountErrorMsg) {
        createAccountErrorMsg.classList.add("hidden");
        createAccountErrorMsg.textContent = "";
      }
    });
  }

  // Fechar modal
  if (closeModalBtn && createAccountModal) {
    closeModalBtn.addEventListener("click", () => {
      createAccountModal.classList.add("hidden");
    });
  }

  // Fechar modal ao clicar fora
  if (createAccountModal) {
    createAccountModal.addEventListener("click", (e) => {
      if (e.target === createAccountModal) {
        createAccountModal.classList.add("hidden");
      }
    });
  }

  // Toggle password visibility
  if (togglePasswordBtn && registerPasswordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const type = registerPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      registerPasswordInput.setAttribute("type", type);
      
      if (type === "text") {
        if (eyeIconRegister) eyeIconRegister.classList.add("hidden");
        if (eyeOffIconRegister) eyeOffIconRegister.classList.remove("hidden");
      } else {
        if (eyeIconRegister) eyeIconRegister.classList.remove("hidden");
        if (eyeOffIconRegister) eyeOffIconRegister.classList.add("hidden");
      }
    });
  }

  // Submeter formulário
  if (createAccountForm) {
    createAccountForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("navbarRegisterEmail").value.trim();
      const password = document.getElementById("navbarRegisterPassword").value.trim();
      const secretCode = document.getElementById("navbarSecretCode").value.trim();
      
      // Validações
      if (!email || !password || !secretCode) {
        showCreateAccountError("Please fill in all fields.");
        return;
      }
      
      // Validar código secreto
      if (secretCode !== SECRET_CODE) {
        showCreateAccountError("Incorrect secret code.");
        return;
      }
      
      // Criar conta
      const res = await register(email, password);
      
      if (!res.ok) {
        showCreateAccountError(formatRegisterError(res.error));
        return;
      }
      
      // Conta criada com sucesso - desativar modo convidado
      disableGuestMode();
      
      // Fazer login automático com a conta criada
      const loginRes = await login(email, password);
      
      if (!loginRes.ok) {
        // Se o login automático falhar, redirecionar para login
        if (createAccountModal) {
          createAccountModal.classList.add("hidden");
        }
        window.location.href = "./login.html";
        return;
      }
      
      // Login bem-sucedido - fechar modal e recarregar página
      if (createAccountModal) {
        createAccountModal.classList.add("hidden");
      }
      
      // Recarregar a página para entrar como utilizador autenticado
      window.location.href = "./index.html";
    });
  }

  function showCreateAccountError(msg, type = "error") {
    if (createAccountErrorMsg) {
      createAccountErrorMsg.textContent = msg;
      createAccountErrorMsg.className = `text-sm text-center rounded-lg p-2 ${
        type === "success"
          ? "bg-green-900/20 border border-green-500/30 text-green-400"
          : "bg-red-900/20 border border-red-500/30 text-red-400"
      }`;
      createAccountErrorMsg.classList.remove("hidden");
    }
  }

  function formatRegisterError(errCode) {
    switch (errCode) {
      case "auth/invalid-email": return "Invalid email.";
      case "auth/email-already-in-use": return "This email is already in use.";
      case "auth/weak-password": return "Password too weak. Use at least 6 characters.";
      case "auth/operation-not-allowed": return "Operation not allowed.";
      default: return "Error creating account: " + errCode;
    }
  }
}

// setupGlobalSearch stays the same
export function setupGlobalSearch(selector, itemSelector = "h3") {
  const searchInput = document.getElementById("search");
  if (!searchInput) return;

  // Redirecionar para search.html quando pressionar Enter
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = e.target.value.trim();
      if (query) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      } else {
        window.location.href = "search.html";
      }
    }
  });

  // Não fazer pesquisa local em páginas que têm sua própria pesquisa
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "search.html" || 
      currentPage === "allmovies.html" || 
      currentPage === "allseries.html") {
    return; // Não fazer pesquisa local - essas páginas têm sua própria pesquisa
  }

  // Pesquisa local (apenas em páginas que não têm pesquisa própria)
  searchInput.addEventListener("input", e => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll(selector).forEach(card => {
      const title = card.querySelector(itemSelector)?.textContent.toLowerCase() || "";
      card.style.display = title.includes(query) ? "" : "none";
    });
  });
}