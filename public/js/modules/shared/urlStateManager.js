// modules/shared/urlStateManager.js
/**
 * Gerencia estado na URL (páginas, query params) e sessionStorage
 * Reutilizável para movies, series, etc.
 */
export class URLStateManager {
  constructor(prefix = '') {
    this.prefix = prefix; // 'movies', 'series', etc.
  }

  getPageFromURL() {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page'), 10);
    return (page && page > 0) ? page : 1;
  }

  updateURL(page) {
    const url = new URL(window.location);
    if (page === 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page);
    }
    window.history.pushState({ page }, '', url);
  }

  savePageState(page) {
    if (this.prefix) {
      sessionStorage.setItem(`${this.prefix}Page`, String(page));
    }
  }

  restorePageState(defaultPage = 1) {
    if (!this.prefix) return defaultPage;
    const saved = sessionStorage.getItem(`${this.prefix}Page`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : defaultPage;
    }
    return defaultPage;
  }

  saveFilters(filters, isFilterMode) {
    if (!this.prefix) return;
    
    const hasActiveFilters =
      filters.topRating ||
      (filters.genres && filters.genres.length > 0) ||
      filters.list;

    if (hasActiveFilters) {
      sessionStorage.setItem(`${this.prefix}Filters`, JSON.stringify(filters));
      sessionStorage.setItem(`${this.prefix}IsFilterMode`, String(isFilterMode));
    } else {
      sessionStorage.removeItem(`${this.prefix}Filters`);
      sessionStorage.removeItem(`${this.prefix}IsFilterMode`);
    }
  }

  restoreFilters() {
    if (!this.prefix) {
      return {
        filters: { topRating: false, genres: [], list: null },
        isFilterMode: false
      };
    }

    try {
      const savedFilters = sessionStorage.getItem(`${this.prefix}Filters`);
      const savedIsFilterMode = sessionStorage.getItem(`${this.prefix}IsFilterMode`) === "true";
      
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        return {
          filters,
          isFilterMode: savedIsFilterMode && (
            filters.topRating ||
            (filters.genres && filters.genres.length > 0) ||
            filters.list
          )
        };
      }
    } catch (err) {
      console.warn(`Error restoring filters for ${this.prefix}:`, err);
    }

    return {
      filters: { topRating: false, genres: [], list: null },
      isFilterMode: false
    };
  }

  markFromCard() {
    if (this.prefix) {
      sessionStorage.setItem(`${this.prefix}FromCard`, "true");
    }
  }

  clearFromCard() {
    if (this.prefix) {
      sessionStorage.removeItem(`${this.prefix}FromCard`);
    }
  }

  cameFromCard() {
    return this.prefix ? sessionStorage.getItem(`${this.prefix}FromCard`) === "true" : false;
  }
}

