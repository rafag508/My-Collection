export function renderHero() {
  const container = document.getElementById("hero");
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-7xl mx-auto px-6 lg:grid lg:grid-cols-12 lg:gap-10 items-center">
      <div class="lg:col-span-7">
        <h1 class="text-4xl font-extrabold leading-tight">
          My personal library of <span class="text-blue-400">Movies</span> & <span class="text-green-400">TV Shows</span>
        </h1>
        <p class="mt-4 text-gray-400 max-w-lg">
          Explore, bookmark, and track your progress. Everything is stored locally.
        </p>
        <div class="mt-6 flex gap-3">
          <a href="movies.html" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold">Watch Movies</a>
          <a href="series.html" class="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 font-semibold">Watch TV Shows</a>
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
