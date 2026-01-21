import { t as translate } from "../modules/idioma.js";

// Função auxiliar para detetar modo PWA
function isPwaMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         window.matchMedia('(display-mode: minimal-ui)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://') ||
         document.documentElement.classList.contains('pwa-mode') ||
         (window.innerWidth <= 768); // Fallback para ecrãs pequenos
}

export function renderHero() {
  const container = document.getElementById("hero");
  if (!container) return;

  const isPWA = isPwaMode();

  // Se estiver em modo PWA, usar estilos inline (sobrepõem Tailwind)
  if (isPWA) {
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6" style="padding: 24px; padding-top: 40px;">
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div style="width: 100%; text-align: center; order: 1;">
            <h1 style="font-size: 42px; line-height: 1.2; margin-bottom: 20px; font-weight: 800; color: white;">
              ${translate("myPersonalLibrary")} <span class="text-blue-400">${translate("movies")}</span> & <span class="text-green-400">${translate("tvShows")}</span>
            </h1>
            <p style="font-size: 22px; max-width: 100%; margin: 0 auto 28px auto; color: rgb(156 163 175);">
              ${translate("exploreBookmarkTrack")}
            </p>
            <div style="display: flex; flex-direction: row; gap: 16px; justify-content: center; margin-top: 24px;">
              <a href="movies.html" style="font-size: 22px; padding: 18px 28px; border-radius: 18px; background-color: rgb(37 99 235); color: white; font-weight: 600; text-decoration: none;">${translate("watchMovies")}</a>
              <a href="series.html" style="font-size: 22px; padding: 18px 28px; border-radius: 18px; background-color: rgb(22 163 74); color: white; font-weight: 600; text-decoration: none;">${translate("watchTVShows")}</a>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // HTML original para desktop
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-6 lg:grid lg:grid-cols-12 lg:gap-10 items-center">
        <div class="lg:col-span-7">
          <h1 class="text-4xl font-extrabold leading-tight">
            ${translate("myPersonalLibrary")} <span class="text-blue-400">${translate("movies")}</span> & <span class="text-green-400">${translate("tvShows")}</span>
          </h1>
          <p class="mt-4 text-gray-400 max-w-lg">
            ${translate("exploreBookmarkTrack")}
          </p>
          <div class="mt-6 flex gap-3">
            <a href="movies.html" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold">${translate("watchMovies")}</a>
            <a href="series.html" class="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 font-semibold">${translate("watchTVShows")}</a>
          </div>
        </div>
        <div class="lg:col-span-5 mt-8 lg:mt-0">
          <div class="relative aspect-[16/9] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
            <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop" alt="Hero" class="absolute inset-0 h-full w-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Atualizar textos quando o idioma mudar
  document.addEventListener("languageChanged", () => {
    renderHero();
  });
}
