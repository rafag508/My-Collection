import { t as translate } from "../modules/idioma.js";

export function renderHero() {
  const container = document.getElementById("hero");
  if (!container) return;

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

  // Atualizar textos quando o idioma mudar
  document.addEventListener("languageChanged", () => {
    renderHero();
  });
}
