// js/notifications/badge.js
// Badge API - Mostra número de notificações no ícone da app instalada

/**
 * Verifica se a Badge API está disponível
 */
export function isBadgeAPISupported() {
  return 'setAppBadge' in navigator && 'clearAppBadge' in navigator;
}

/**
 * Define o badge com o número de notificações não lidas
 * @param {number} count - Número de notificações não lidas
 */
export async function setBadge(count) {
  if (!isBadgeAPISupported()) {
    return false;
  }

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
    return true;
  } catch (error) {
    console.warn('Failed to set app badge:', error);
    return false;
  }
}

/**
 * Limpa o badge
 */
export async function clearBadge() {
  if (!isBadgeAPISupported()) {
    return false;
  }

  try {
    await navigator.clearAppBadge();
    return true;
  } catch (error) {
    console.warn('Failed to clear app badge:', error);
    return false;
  }
}

