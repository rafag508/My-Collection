// modules/shared/searchHandler.js
/**
 * Handler de pesquisa reutilizável com debounce
 */
export class SearchHandler {
  constructor(config) {
    this.inputId = config.inputId || 'search';
    this.debounceDelay = config.debounceDelay || 350;
    this.onSearch = config.onSearch || (() => {});
    this.onClear = config.onClear || (() => {});
    this.searchTimeout = null;
  }

  setup() {
    const input = document.getElementById(this.inputId);
    if (!input) return;

    input.addEventListener("input", (e) => {
      const query = e.target.value.trim();

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      if (query === "") {
        this.onClear();
        return;
      }

      this.searchTimeout = setTimeout(() => {
        this.onSearch(query);
      }, this.debounceDelay);
    });
  }

  clear() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }
}

