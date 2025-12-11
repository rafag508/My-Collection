export function openModal(selector) {
  const modal = document.querySelector(selector);
  if (!modal) return console.error(`❌ Modal not found: ${selector}`);
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

export function closeModal(selector) {
  const modal = document.querySelector(selector);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

export function setupModalTriggers() {
  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-open");
      openModal(target);
    });
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-close");
      closeModal(target);
    });
  });
}
