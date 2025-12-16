// src/modules/pwaInstall.js
// Gerencia a instalação do PWA

// ✅ LOG IMEDIATO para verificar se o módulo está a carregar
console.log('[PWA] Module pwaInstall.js loaded');

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

// Detectar se é Firefox
export function isFirefox() {
  return navigator.userAgent.toLowerCase().includes('firefox');
}

// Capturar evento beforeinstallprompt (Android/Chrome)
export function setupInstallPrompt() {
  console.log('[PWA] Setting up install prompt');
  console.log('[PWA] isFirefox():', isFirefox());
  console.log('[PWA] isInstalled():', isInstalled());
  console.log('[PWA] installButton exists:', !!installButton);
  
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt event fired');
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  // ✅ Para Firefox, mostrar botão sempre (se não estiver instalado)
  // Firefox não suporta beforeinstallprompt, então mostramos o botão manualmente
  // Nota: O botão já deve estar visível se foi inicializado corretamente em initInstallButton
  if (isFirefox() && !isInstalled() && installButton) {
    console.log('[PWA] Firefox detected in setupInstallPrompt, ensuring button is visible');
    // Garantir que está visível (pode ter sido escondido por algum motivo)
    showInstallButton();
    
    // ✅ Verificar novamente após um delay para resolver problemas de timing
    // Isto garante que o botão aparece mesmo após mudanças de página ou refresh normal
    setTimeout(() => {
      if (isFirefox() && !isInstalled() && installButton) {
        console.log('[PWA] Firefox: Double-checking button visibility after delay');
        showInstallButton();
      }
    }, 500); // 500ms delay
  }
  
  // ✅ Para Chrome/Android: Mostrar botão sempre se não estiver instalado
  // Mesmo que beforeinstallprompt não tenha disparado (pode ter sido recusado antes)
  if (!isFirefox() && !isInstalled() && installButton) {
    console.log('[PWA] Chrome/Android detected, showing button (beforeinstallprompt may fire later)');
    showInstallButton();
  }
 
  // Se já está instalado, esconder botão
  if (isInstalled()) {
    console.log('[PWA] Already installed, hiding button');
    hideInstallButton();
  }
}

// Mostrar botão de instalação
export function showInstallButton() {
  if (installButton) {
    console.log('[PWA] Showing install button');
    // ✅ Remover classe 'hidden' do Tailwind (tem !important)
    installButton.classList.remove('hidden');
    installButton.style.display = 'flex';
    console.log('[PWA] Button classes after show:', installButton.className);
    console.log('[PWA] Button display style:', installButton.style.display);
  } else {
    console.warn('[PWA] Cannot show button: installButton is null');
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
    alert('A instalação não está disponível no momento. Por favor, use o menu do browser (⋮) → "Instalar My Collection" ou tente novamente mais tarde.');
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

// Mostrar instruções para Firefox
export function showFirefoxInstructions() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-xl shadow-2xl p-6 w-[90%] max-w-md relative">
      <button class="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl" onclick="this.closest('.fixed').remove()">✖</button>
      <h2 class="text-2xl font-bold mb-4 text-center text-blue-400">Instalar App</h2>
      <div class="space-y-4 text-gray-300">
        <p class="text-center">Para instalar no Firefox:</p>
        <ol class="list-decimal list-inside space-y-2 ml-4">
          <li>Clique no ícone de <strong>menu</strong> <span class="text-2xl">☰</span> no canto superior direito</li>
          <li>Procure por <strong>"Instalar"</strong> ou <strong>"Mais ferramentas"</strong></li>
          <li>Clique em <strong>"Instalar"</strong> ou use o atalho <kbd class="px-2 py-1 bg-gray-800 rounded">Menu → Instalar</kbd></li>
        </ol>
        <p class="text-center text-sm text-gray-400 mt-4">O app aparecerá como uma aplicação instalada!</p>
        <p class="text-center text-xs text-gray-500 mt-2">Nota: Se não vir a opção "Instalar", o site pode não cumprir todos os requisitos de PWA no Firefox.</p>
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

  console.log('[PWA] Initializing install button');
  console.log('[PWA] Button element:', installButton);
  console.log('[PWA] Current display:', installButton.style.display);
  console.log('[PWA] isFirefox():', isFirefox());
  console.log('[PWA] isInstalled():', isInstalled());

  // Adicionar event listener primeiro
  installButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // ✅ Não fechar o dropdown do perfil ao clicar
    console.log('[PWA] Install button clicked');
    if (isIOS()) {
      showIOSInstructions();
    } else if (isFirefox()) {
      showFirefoxInstructions();
    } else {
      await installPWA();
    }
  });

  // ✅ Para Firefox, mostrar imediatamente (se não estiver instalado)
  // Não esconder inicialmente se for Firefox
  const firefoxDetected = isFirefox();
  const alreadyInstalled = isInstalled();
  
  console.log('[PWA] Firefox detected:', firefoxDetected);
  console.log('[PWA] Already installed:', alreadyInstalled);
  
  if (alreadyInstalled) {
    console.log('[PWA] Already installed, hiding button');
    hideInstallButton();
  } else if (firefoxDetected) {
    console.log('[PWA] Firefox detected in initInstallButton, showing button immediately');
    // Mostrar imediatamente para Firefox
    // ✅ Remover classe 'hidden' do Tailwind (tem !important)
    installButton.classList.remove('hidden');
    installButton.style.display = 'flex';
    console.log('[PWA] Button classes after Firefox init:', installButton.className);
    
    // ✅ Verificar novamente após um delay para garantir que permanece visível
    // Isto resolve problemas quando mudas de página ou fazes refresh normal (F5)
    setTimeout(() => {
      if (isFirefox() && !isInstalled() && installButton) {
        console.log('[PWA] Firefox: Ensuring button is still visible after init delay');
        showInstallButton();
      }
    }, 300); // 300ms delay
  } else {
    // Para outros browsers, mostrar botão (será gerido pelo setupInstallPrompt)
    console.log('[PWA] Not Firefox, button visibility will be managed by setupInstallPrompt');
    // Não esconder aqui - deixar o setupInstallPrompt decidir
  }
}

