export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export function debounce(fn, wait = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function slugify(text = "") {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function safeJSON(data, fallback = {}) {
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

export function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, callback) {
  document.addEventListener(name, callback);
}

export function isEmpty(obj) {
  return obj && typeof obj === "object" && Object.keys(obj).length === 0;
}
