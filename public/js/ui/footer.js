import { t as translate } from "../modules/idioma.js";

export function renderFooter() {
  const container = document.getElementById("footer");
  if (!container) return;

  container.innerHTML = `
    <footer class="mt-auto border-t border-white/5 bg-black/40">
      <div class="max-w-7xl mx-auto p-6 text-sm text-gray-400 flex flex-col sm:flex-row justify-between items-center">
        <p>© <span id="year"></span> ${translate('myCollection')} — ${translate('personalUse')}.</p>
        <div class="flex gap-4">
          <a href="#" class="hover:text-white">${translate('terms')}</a>
          <a href="#" class="hover:text-white">${translate('privacy')}</a>
        </div>
      </div>
    </footer>
  `;

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}
