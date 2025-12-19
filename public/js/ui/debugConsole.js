// Debug Console para mobile
class DebugConsole {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.createUI();
    this.interceptConsole();
  }

  createUI() {
    const consoleDiv = document.createElement('div');
    consoleDiv.id = 'debugConsole';
    consoleDiv.innerHTML = `
      <div class="debug-console-header">
        <span>Debug Console</span>
        <button id="debugConsoleToggle">▼</button>
        <button id="debugConsoleClear">Clear</button>
      </div>
      <div class="debug-console-content" id="debugConsoleContent"></div>
    `;
    document.body.appendChild(consoleDiv);
    this.setupEvents();
  }

  setupEvents() {
    const toggle = document.getElementById('debugConsoleToggle');
    const clear = document.getElementById('debugConsoleClear');
    const content = document.getElementById('debugConsoleContent');
    
    toggle?.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      toggle.textContent = isHidden ? '▼' : '▲';
    });
    
    clear?.addEventListener('click', () => {
      this.logs = [];
      this.updateUI();
    });
  }

  interceptConsole() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      this.addLog('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog('error', args);
      originalError.apply(console, args);
    };
  }

  addLog(type, args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    this.logs.push({ type, timestamp, message });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.updateUI();
  }

  updateUI() {
    const content = document.getElementById('debugConsoleContent');
    if (!content) return;

    content.innerHTML = this.logs.map(log => `
      <div class="debug-log debug-log-${log.type}">
        <span class="debug-time">[${log.timestamp}]</span>
        <span class="debug-message">${this.escapeHtml(log.message)}</span>
      </div>
    `).join('');
    content.scrollTop = content.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Inicializar apenas em app mode
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone || 
    window.innerWidth <= 768) {
  window.debugConsole = new DebugConsole();
}

