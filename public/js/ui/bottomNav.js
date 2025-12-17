// src/ui/bottomNav.js
// Bottom Navigation para modo app (PWA standalone)

import { logout } from "../firebase/auth.js";

export function renderBottomNav() {
  // Só renderizar se ainda não existe
  if (document.getElementById('bottom-nav')) return;

  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  
  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.className = 'bottom-nav';
  
  const items = [
    { id: 'home', label: 'Home', icon: 'home', href: '/index.html', pages: ['index', ''] },
    { id: 'search', label: 'Search', icon: 'search', href: null, pages: ['search'] },
    { id: 'movies', label: 'Movies', icon: 'movies', href: '/movies.html', pages: ['movies', 'movie', 'allmovie'] },
    { id: 'series', label: 'TV Shows', icon: 'tv', href: '/series.html', pages: ['series', 'serie', 'allserie', 'allseries'] },
    { id: 'profile', label: 'Profile', icon: 'profile', href: null, pages: ['profile', 'settings', 'notifications'] }
  ];

  nav.innerHTML = items.map(item => {
    const isActive = item.pages.includes(currentPage);
    if (item.href) {
      return `
        <a href="${item.href}" class="bottom-nav-item ${isActive ? 'active' : ''}" data-nav="${item.id}">
          ${getIcon(item.icon, isActive)}
          <span>${item.label}</span>
        </a>
      `;
    } else {
      return `
        <button class="bottom-nav-item ${isActive ? 'active' : ''}" data-nav="${item.id}">
          ${getIcon(item.icon, isActive)}
          <span>${item.label}</span>
        </button>
      `;
    }
  }).join('');

  document.body.appendChild(nav);
  
  // Criar menu de profile
  createProfileMenu();
  
  // Listener para Profile - abre menu
  const profileBtn = nav.querySelector('[data-nav="profile"]');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleProfileMenu();
    });
  }
  
  // Listener para Search - abre modal (a implementar depois)
  const searchBtn = nav.querySelector('[data-nav="search"]');
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // TODO: Abrir modal de search
      window.location.href = '/movies.html';
    });
  }
}

// Criar menu popup do profile
function createProfileMenu() {
  if (document.getElementById('profile-popup-menu')) return;
  
  const menu = document.createElement('div');
  menu.id = 'profile-popup-menu';
  menu.className = 'profile-popup-menu hidden';
  menu.innerHTML = `
    <a href="/notifications.html" class="profile-menu-item">
      <svg class="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span>Notifications</span>
    </a>
    <a href="/stats.html" class="profile-menu-item">
      <svg class="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 20V10"/>
        <path d="M12 20V4"/>
        <path d="M6 20v-6"/>
      </svg>
      <span>Stats</span>
    </a>
    <a href="/settings.html" class="profile-menu-item">
      <svg class="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      <span>Settings</span>
    </a>
    <button class="profile-menu-item logout-btn">
      <svg class="profile-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      <span>Logout</span>
    </button>
  `;
  
  document.body.appendChild(menu);
  
  // Listener para logout
  menu.querySelector('.logout-btn').addEventListener('click', async () => {
    await logout();
    window.location.href = '/login.html';
  });
  
  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('profile-popup-menu');
    const profileBtn = document.querySelector('[data-nav="profile"]');
    if (menu && !menu.contains(e.target) && !profileBtn?.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
}

// Toggle menu do profile
function toggleProfileMenu() {
  const menu = document.getElementById('profile-popup-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function getIcon(type, isActive) {
  const color = isActive ? '#3b82f6' : '#6b7280';
  
  const icons = {
    home: `<svg class="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
    
    search: `<svg class="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>`,
    
    movies: `<svg class="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
    </svg>`,
    
    tv: `<svg class="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
      <polyline points="17 2 12 7 7 2"/>
    </svg>`,
    
    profile: `<svg class="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`
  };
  
  return icons[type] || '';
}

