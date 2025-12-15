// src/modules/pwaInstall.js
// Gerencia a instalação do PWA

let deferredPrompt = null;
let installButton = null;

// Detectar se já está instalado
export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

// Detectar se é iOS
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Capturar evento beforeinstallprompt (Android/Chrome)
export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt event fired');
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  // Se já está instalado, esconder botão
  if (isInstalled()) {
    hideInstallButton();
  }
}

// Mostrar botão de instalação
export function showInstallButton() {
  if (installButton) {
    installButton.style.display = 'flex';
  }
}

// Esconder botão de instalação
export function hideInstallButton() {
  if (installButton) {
    installButton.style.display = 'none';
  }
}

// Instalar PWA (Android/Chrome)
export async function installPWA() {
  if (!deferredPrompt) {
    console.warn('[PWA] No install prompt available');
    return false;
  }

  try {
    // Mostrar prompt de instalação
    deferredPrompt.prompt();
    
    // Esperar resposta do utilizador
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log('[PWA] User choice:', outcome);
    
    if (outcome === 'accepted') {
      console.log('[PWA] App installed');
      hideInstallButton();
      return true;
    } else {
      console.log('[PWA] App installation declined');
      return false;
    }
  } catch (error) {
    console.error('[PWA] Error during installation:', error);
    return false;
  } finally {
    deferredPrompt = null;
  }
}

// Mostrar instruções para iOS
export function showIOSInstructions() {
  const isStandalone = window.navigator.standalone === true;
  
  if (isStandalone) {
    return; // Já está instalado
  }

  // Criar modal com instruções
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-xl shadow-2xl p-6 w-[90%] max-w-md relative">
      <button class="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl" onclick="this.closest('.fixed').remove()">✖</button>
      <h2 class="text-2xl font-bold mb-4 text-center text-blue-400">Instalar App</h2>
      <div class="space-y-4 text-gray-300">
        <p class="text-center">Para instalar no iPhone/iPad:</p>
        <ol class="list-decimal list-inside space-y-2 ml-4">
          <li>Toque no botão <strong>Partilhar</strong> <span class="text-2xl">📤</span> na barra inferior</li>
          <li>Role para baixo e toque em <strong>"Adicionar ao Ecrã Principal"</strong></li>
          <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
        </ol>
        <p class="text-center text-sm text-gray-400 mt-4">O app aparecerá no seu ecrã inicial!</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Inicializar botão de instalação
export function initInstallButton(buttonElement) {
  installButton = buttonElement;
  
  if (!installButton) {
    console.warn('[PWA] Install button element not found');
    return;
  }

  // Esconder inicialmente
  hideInstallButton();

  // Adicionar event listener
  installButton.addEventListener('click', async () => {
    if (isIOS()) {
      showIOSInstructions();
    } else {
      await installPWA();
    }
  });

  // Verificar se já está instalado
  if (isInstalled()) {
    hideInstallButton();
  }
}

