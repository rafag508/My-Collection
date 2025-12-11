// modules/shared/pagination.js
/**
 * Sistema de paginação reutilizável
 * Funciona para movies, series, notifications, etc.
 */
export class PaginationManager {
  constructor(config) {
    this.pageSize = config.pageSize || 18;
    this.currentPage = config.initialPage || 1;
    this.buttonPrefix = config.buttonPrefix || 'page'; // 'movies', 'series', etc.
    this.activeColor = config.activeColor || 'bg-blue-600'; // 'bg-blue-600' ou 'bg-green-600'
    this.onPageChange = config.onPageChange || (() => {});
    this.getTotalItems = config.getTotalItems || (() => 0);
    this.updateURL = config.updateURL || (() => {});
  }

  getTotalPages() {
    const totalItems = this.getTotalItems();
    return Math.max(1, Math.ceil(totalItems / this.pageSize));
  }

  ensureCurrentPageInRange() {
    const total = this.getTotalPages();
    if (this.currentPage > total) this.currentPage = total;
    if (this.currentPage < 1) this.currentPage = 1;
  }

  setPage(page) {
    this.currentPage = page;
    this.ensureCurrentPageInRange();
    if (this.updateURL) {
      this.updateURL(this.currentPage);
    }
    this.onPageChange(this.currentPage);
  }

  nextPage() {
    const total = this.getTotalPages();
    if (this.currentPage < total) {
      this.setPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.setPage(this.currentPage - 1);
    }
  }

  firstPage() {
    this.setPage(1);
  }

  lastPage() {
    this.setPage(this.getTotalPages());
  }

  getPageItems(allItems) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return allItems.slice(start, end);
  }

  render(containerTopId, containerBottomId) {
    const top = document.getElementById(containerTopId);
    const bottom = document.getElementById(containerBottomId);

    if (!top || !bottom) return;

    const total = this.getTotalPages();
    if (total <= 1) {
      top.innerHTML = "";
      bottom.innerHTML = "";
      return;
    }

    const html = this.buildHTML(total);
    top.innerHTML = html;
    bottom.innerHTML = html;
    this.attachEvents();
  }

  buildHTML(total) {
    let html = `<div class="flex items-center justify-center gap-2 mt-6">`;
    
    // First button
    if (this.currentPage >= 2) {
      html += `<button class="${this.buttonPrefix}FirstBtn px-3 py-1 rounded bg-gray-800 hover:bg-gray-700" title="First page">««</button>`;
    }
    
    // Previous button
    if (this.currentPage > 1) {
      html += `<button class="${this.buttonPrefix}PrevBtn px-3 py-1 rounded bg-gray-800 hover:bg-gray-700">Prev</button>`;
    }

    // Page numbers
    const maxButtons = 7;
    let start = Math.max(1, this.currentPage - 3);
    let end = Math.min(total, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    if (start > 1) {
      html += `<button class="${this.buttonPrefix}-page-btn px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" data-page="1">1</button>`;
      if (start > 2) html += `<span class="px-2">…</span>`;
    }

    for (let p = start; p <= end; p++) {
      const isActive = p === this.currentPage;
      html += `<button class="${this.buttonPrefix}-page-btn px-3 py-1 rounded ${isActive ? this.activeColor : 'bg-gray-800 hover:bg-gray-700'}" data-page="${p}">${p}</button>`;
    }

    if (end < total) {
      if (end < total - 1) html += `<span class="px-2">…</span>`;
      html += `<button class="${this.buttonPrefix}-page-btn px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" data-page="${total}">${total}</button>`;
    }

    // Next button
    if (this.currentPage < total) {
      html += `<button class="${this.buttonPrefix}NextBtn px-3 py-1 rounded bg-gray-800 hover:bg-gray-700">Next</button>`;
      html += `<button class="${this.buttonPrefix}LastBtn px-3 py-1 rounded bg-gray-800 hover:bg-gray-700" title="Last page">»»</button>`;
    }
    
    html += `</div>`;
    return html;
  }

  attachEvents() {
    // First
    document.querySelectorAll(`.${this.buttonPrefix}FirstBtn`).forEach(btn => {
      btn.onclick = () => this.firstPage();
    });

    // Previous
    document.querySelectorAll(`.${this.buttonPrefix}PrevBtn`).forEach(btn => {
      btn.onclick = () => this.prevPage();
    });

    // Next
    document.querySelectorAll(`.${this.buttonPrefix}NextBtn`).forEach(btn => {
      btn.onclick = () => this.nextPage();
    });

    // Last
    document.querySelectorAll(`.${this.buttonPrefix}LastBtn`).forEach(btn => {
      btn.onclick = () => this.lastPage();
    });

    // Page buttons
    document.querySelectorAll(`.${this.buttonPrefix}-page-btn`).forEach(btn => {
      btn.addEventListener("click", () => {
        const p = Number(btn.dataset.page);
        if (!isNaN(p)) {
          this.setPage(p);
        }
      });
    });
  }

  // Listener para botão retroceder do browser
  setupPopStateListener() {
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.page) {
        this.currentPage = e.state.page;
        this.onPageChange(this.currentPage);
      } else if (this.updateURL) {
        // Ler da URL
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page'), 10);
        if (page && page > 0) {
          this.currentPage = page;
          this.onPageChange(this.currentPage);
        }
      }
    });
  }
}

