export function showToast(message, color = "bg-green-600") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `
    fixed bottom-6 right-6
    ${color} text-white
    px-4 py-2 rounded-lg shadow-lg text-sm
    opacity-0 transition-opacity duration-500 z-[9999]
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("opacity-100"), 50);
  setTimeout(() => {
    toast.classList.remove("opacity-100");
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

export function toastSuccess(msg) { showToast(msg, "bg-green-600"); }
export function toastError(msg) { showToast(msg, "bg-red-600"); }
export function toastWarning(msg) { showToast(msg, "bg-yellow-600 text-black"); }
