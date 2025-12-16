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

// Detectar se é Firefox
export function isFirefox() {
  return navigator.userAgent.toLowerCase().includes('firefox');
}

// Capturar evento beforeinstallprompt (Android/Chrome)
export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  // ✅ Para Firefox, mostrar botão sempre (se não estiver instalado)
  // Firefox não suporta beforeinstallprompt, então mostramos o botão manualmente
  if (isFirefox() && !isInstalled() && installButton) {
    showInstallButton();
    
    // Verificar novamente após um delay para resolver problemas de timing
    setTimeout(() => {
      if (isFirefox() && !isInstalled() && installButton) {
        showInstallButton();
      }
    }, 500);
  }
  
  // ✅ Para Chrome/Android: Mostrar botão sempre se não estiver instalado
  // Mesmo que beforeinstallprompt não tenha disparado (pode ter sido recusado antes)
  if (!isFirefox() && !isInstalled() && installButton) {
    showInstallButton();
  }
 
  // Se já está instalado, esconder botão
  if (isInstalled()) {
    hideInstallButton();
  }
}

// Mostrar botão de instalação
export function showInstallButton() {
  if (installButton) {
    // Remover classe 'hidden' do Tailwind (tem !important)
    installButton.classList.remove('hidden');
    installButton.style.display = 'flex';
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
    
    if (outcome === 'accepted') {
      hideInstallButton();
      return true;
    } else {
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

  // Adicionar event listener primeiro
  installButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Não fechar o dropdown do perfil ao clicar
    if (isIOS()) {
      showIOSInstructions();
    } else if (isFirefox()) {
      showFirefoxInstructions();
    } else {
      await installPWA();
    }
  });

  // Para Firefox, mostrar imediatamente (se não estiver instalado)
  const firefoxDetected = isFirefox();
  const alreadyInstalled = isInstalled();
  
  if (alreadyInstalled) {
    hideInstallButton();
  } else if (firefoxDetected) {
    // Mostrar imediatamente para Firefox
    // Remover classe 'hidden' do Tailwind (tem !important)
    installButton.classList.remove('hidden');
    installButton.style.display = 'flex';
    
    // Verificar novamente após um delay para garantir que permanece visível
    setTimeout(() => {
      if (isFirefox() && !isInstalled() && installButton) {
        showInstallButton();
      }
    }, 300);
  }
  // Para outros browsers, o setupInstallPrompt vai gerir a visibilidade
}

