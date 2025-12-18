// Debug Console para mobile
let debugLogs = [];
const MAX_LOGS = 100;

// Interceptar console.log, console.warn, console.error
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) {
  originalLog.apply(console, args);
  addLog('log', args);
};

console.warn = function(...args) {
  originalWarn.apply(console, args);
  addLog('warn', args);
};

console.error = function(...args) {
  originalError.apply(console, args);
  addLog('error', args);
};

function addLog(type, args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  debugLogs.push({
    type,
    message,
    time: new Date().toLocaleTimeString()
  });
  
  if (debugLogs.length > MAX_LOGS) {
    debugLogs.shift();
  }
  
  updateDebugUI();
}

function updateDebugUI() {
  const logsContainer = document.getElementById('debugLogs');
  if (!logsContainer) return;
  
  logsContainer.innerHTML = debugLogs.map(log => {
    const color = log.type === 'error' ? 'text-red-400' : 
                  log.type === 'warn' ? 'text-yellow-400' : 
                  'text-green-400';
    return `<div class="${color}">[${log.time}] ${log.message}</div>`;
  }).join('');
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

export function setupDebugConsole() {
  // Só mostrar no modo app
  const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true ||
                    window.innerWidth <= 768;
  
  if (!isAppMode) return;
  
  const btn = document.getElementById('debugConsoleBtn');
  const panel = document.getElementById('debugConsole');
  const closeBtn = document.getElementById('closeDebugConsole');
  const clearBtn = document.getElementById('clearDebugLogs');
  
  if (!btn || !panel) return;
  
  btn.classList.remove('hidden');
  
  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    updateDebugUI();
  });
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      debugLogs = [];
      updateDebugUI();
    });
  }
}

