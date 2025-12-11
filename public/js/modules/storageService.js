// src/modules/storageService.js
// Usa sessionStorage em modo convidado, localStorage caso contrário

function getStorage() {
  // Verificar se está em modo convidado (sem import circular)
  const isGuest = sessionStorage.getItem("guest_mode_active") === "true";
  return isGuest ? sessionStorage : localStorage;
}

export const storageService = {
  async get(key, fallback = null) {
    try {
      const storage = getStorage();
      const res = storage.getItem(key);
      if (!res) return fallback;
      return JSON.parse(res);
    } catch (err) {
      console.error("❌ storageService.get ERROR:", err);
      return fallback;
    }
  },

  async set(key, value) {
    try {
      const storage = getStorage();
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("❌ storageService.set ERROR:", err);
      return false;
    }
  },

  async remove(key) {
    try {
      const storage = getStorage();
      storage.removeItem(key);
      return true;
    } catch (err) {
      console.error("❌ storageService.remove ERROR:", err);
      return false;
    }
  },

  async keys() {
    const storage = getStorage();
    return Object.keys(storage);
  },

  async clear() {
    const storage = getStorage();
    storage.clear();
  }
};
