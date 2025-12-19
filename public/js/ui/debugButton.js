// js/ui/debugButton.js
// Botão flutuante de debug que abre um modal com informações

import { getFCMToken, initFCM } from "../notifications/fcm.js";
import { setBadge, clearBadge, isBadgeAPISupported } from "../notifications/badge.js";
import { getNotifications } from "../modules/notifications.js";
import { getFCMTokensFromFirestore } from "../firebase/firestore.js";

let debugModalOpen = false;

function createDebugButton() {
  // Verificar se já existe
  if (document.getElementById('debugFloatingButton')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'debugFloatingButton';
  button.innerHTML = '🔍';
  button.className = 'fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xl shadow-lg flex items-center justify-center transition-all';
  button.style.cssText = 'position: fixed; bottom: 120px; right: 16px; z-index: 9999; width: 48px; height: 48px; border-radius: 9999px; background-color: #2563eb; color: white; font-size: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: background-color 0.2s;';
  button.title = 'Debug Info';
  button.addEventListener('click', toggleDebugModal);
  
  document.body.appendChild(button);
}

function createDebugModal() {
  // Verificar se já existe
  if (document.getElementById('debugModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'debugModal';
  modal.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 hidden';
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
      <div class="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h2 class="text-2xl font-bold text-white">🔍 Debug Information</h2>
        <button id="closeDebugModal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
      </div>
      
      <div class="p-6 space-y-4">
        <!-- Service Worker Status -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Service Worker</h3>
          <div id="swStatus" class="mb-2">
            <span class="px-2 py-1 rounded text-sm bg-yellow-500 text-white">Checking...</span>
          </div>
          <div id="swDetails" class="text-gray-300 text-sm"></div>
        </div>

        <!-- FCM Token -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">FCM Tokens</h3>
          <div id="fcmStatus" class="mb-2">
            <span class="px-2 py-1 rounded text-sm bg-yellow-500 text-white">Loading...</span>
          </div>
          <div id="fcmTokenCount" class="text-gray-300 text-sm mb-2"></div>
          <div id="fcmTokens" class="space-y-2"></div>
          <button id="refreshFCM" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Refresh FCM Token
          </button>
        </div>

        <!-- Notification Permissions -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Notification Permissions</h3>
          <div id="permStatus" class="mb-2"></div>
          <button id="requestPerm" class="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            Request Permission
          </button>
        </div>

        <!-- Badge API -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Badge API</h3>
          <div id="badgeStatus" class="mb-2"></div>
          <div class="mt-3 flex gap-2">
            <button id="setBadge" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
              Set Badge (1)
            </button>
            <button id="clearBadge" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
              Clear Badge
            </button>
          </div>
        </div>

        <!-- Notifications Count -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Notifications</h3>
          <div id="notifCount" class="text-gray-300"></div>
        </div>

        <!-- Device Info -->
        <div class="bg-gray-800 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-white mb-2">Device Info</h3>
          <div id="deviceInfo" class="text-gray-300 text-sm space-y-1"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('closeDebugModal').addEventListener('click', toggleDebugModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      toggleDebugModal();
    }
  });

  // FCM Token refresh
  document.getElementById('refreshFCM').addEventListener('click', async () => {
    await initFCM();
    setTimeout(updateFCMToken, 1000);
  });

  // Request permission
  document.getElementById('requestPerm').addEventListener('click', async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      updatePermissions();
      if (permission === 'granted') {
        await initFCM();
        setTimeout(updateFCMToken, 1000);
      }
    }
  });

  // Badge buttons
  document.getElementById('setBadge').addEventListener('click', async () => {
    await setBadge(1);
    alert('Badge set to 1');
  });

  document.getElementById('clearBadge').addEventListener('click', async () => {
    await clearBadge();
    alert('Badge cleared');
  });
}

function toggleDebugModal() {
  const modal = document.getElementById('debugModal');
  if (!modal) return;

  debugModalOpen = !debugModalOpen;
  
  if (debugModalOpen) {
    modal.classList.remove('hidden');
    updateAllDebugInfo();
    // Atualizar a cada 3 segundos enquanto aberto
    const intervalId = setInterval(() => {
      if (!debugModalOpen) {
        clearInterval(intervalId);
        return;
      }
      updateFCMToken();
      updateNotificationsCount();
    }, 3000);
    modal.dataset.intervalId = intervalId;
  } else {
    modal.classList.add('hidden');
    if (modal.dataset.intervalId) {
      clearInterval(parseInt(modal.dataset.intervalId));
    }
  }
}

async function updateAllDebugInfo() {
  await Promise.all([
    checkServiceWorker(),
    updateFCMToken(),
    updatePermissions(),
    updateBadgeStatus(),
    updateNotificationsCount(),
    updateDeviceInfo()
  ]);
}

async function checkServiceWorker() {
  const swStatus = document.getElementById('swStatus');
  const swDetails = document.getElementById('swDetails');
  
  if (!swStatus || !swDetails) return;

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        swStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-green-500 text-white">Registered</span>';
        let details = '<div class="mt-2 space-y-1">';
        registrations.forEach((reg, index) => {
          details += `<div>SW ${index + 1}: ${reg.scope}</div>`;
          details += `<div class="text-xs text-gray-400">State: ${reg.active?.state || 'unknown'}</div>`;
        });
        details += '</div>';
        swDetails.innerHTML = details;
      } else {
        swStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Not Registered</span>';
        swDetails.innerHTML = '<div class="text-gray-400 text-sm mt-2">No service workers found.</div>';
      }
    } catch (error) {
      swStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Error</span>';
      swDetails.innerHTML = `<div class="text-red-400 text-sm mt-2">${error.message}</div>`;
    }
  } else {
    swStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Not Supported</span>';
    swDetails.innerHTML = '<div class="text-gray-400 text-sm mt-2">Service Workers are not supported.</div>';
  }
}

async function updateFCMToken() {
  const fcmStatus = document.getElementById('fcmStatus');
  const fcmTokenCount = document.getElementById('fcmTokenCount');
  const fcmTokens = document.getElementById('fcmTokens');
  
  if (!fcmStatus || !fcmTokenCount || !fcmTokens) return;

  try {
    // Obter token atual (local)
    const currentToken = getFCMToken();
    
    // Obter todos os tokens do Firestore
    const allTokens = await getFCMTokensFromFirestore();
    
    if (allTokens.length > 0) {
      fcmStatus.innerHTML = `<span class="px-2 py-1 rounded text-sm bg-green-500 text-white">${allTokens.length} Token(s) Available</span>`;
      fcmTokenCount.textContent = `Total devices: ${allTokens.length} (max: 5)`;
      
      // Mostrar todos os tokens
      fcmTokens.innerHTML = allTokens.map((token, index) => {
        const isCurrent = token === currentToken;
        return `
          <div class="bg-gray-900 p-2 rounded text-gray-300 text-xs font-mono break-all">
            <div class="flex items-center justify-between mb-1">
              <span class="text-gray-400 text-xs">Device ${index + 1}</span>
              ${isCurrent ? '<span class="px-2 py-0.5 rounded text-xs bg-blue-500 text-white">Current</span>' : ''}
            </div>
            <div class="text-xs">${token}</div>
          </div>
        `;
      }).join('');
    } else if (currentToken) {
      fcmStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-yellow-500 text-white">Token Available (Not Saved)</span>';
      fcmTokenCount.textContent = 'Token exists locally but not in Firestore';
      fcmTokens.innerHTML = `
        <div class="bg-gray-900 p-2 rounded text-gray-300 text-xs font-mono break-all">
          <div class="text-xs">${currentToken}</div>
        </div>
      `;
    } else {
      fcmStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-yellow-500 text-white">No Token</span>';
      fcmTokenCount.textContent = 'FCM token not available. Try initializing FCM.';
      fcmTokens.innerHTML = '';
    }
  } catch (error) {
    fcmStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Error</span>';
    fcmTokenCount.textContent = `Error: ${error.message}`;
    fcmTokens.innerHTML = '';
  }
}

function updatePermissions() {
  const permStatus = document.getElementById('permStatus');
  if (!permStatus) return;

  if ('Notification' in window) {
    const permission = Notification.permission;
    if (permission === 'granted') {
      permStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-green-500 text-white">Granted</span>';
    } else if (permission === 'denied') {
      permStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Denied</span>';
    } else {
      permStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-yellow-500 text-white">Default (Not Set)</span>';
    }
  } else {
    permStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Not Supported</span>';
  }
}

function updateBadgeStatus() {
  const badgeStatus = document.getElementById('badgeStatus');
  if (!badgeStatus) return;

  if (isBadgeAPISupported()) {
    badgeStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-green-500 text-white">Supported</span>';
  } else {
    badgeStatus.innerHTML = '<span class="px-2 py-1 rounded text-sm bg-red-500 text-white">Not Supported</span>';
  }
}

async function updateNotificationsCount() {
  const notifCount = document.getElementById('notifCount');
  if (!notifCount) return;

  try {
    const notifications = await getNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;
    notifCount.innerHTML = `
      <div>Total: ${notifications.length}</div>
      <div>Unread: <span class="font-bold">${unreadCount}</span></div>
    `;
  } catch (error) {
    notifCount.innerHTML = `<div class="text-red-400">Error: ${error.message}</div>`;
  }
}

function updateDeviceInfo() {
  const deviceInfo = document.getElementById('deviceInfo');
  if (!deviceInfo) return;

  const info = {
    'User Agent': navigator.userAgent.substring(0, 80) + '...',
    'Platform': navigator.platform,
    'Standalone': window.navigator.standalone || false,
    'Display Mode': window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    'PWA Installed': window.matchMedia('(display-mode: standalone)').matches,
  };

  let html = '';
  for (const [key, value] of Object.entries(info)) {
    html += `<div><span class="font-semibold">${key}:</span> ${value}</div>`;
  }
  deviceInfo.innerHTML = html;
}

export function initDebugButton() {
  // Só criar se estiver em modo app ou desenvolvimento
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true;
  
  // Criar sempre (podes remover esta condição se quiseres sempre visível)
  createDebugButton();
  createDebugModal();
}

