// src/ui/bottomNav.js
// Bottom Navigation para modo app (PWA standalone)

export function renderBottomNav() {
  // Só renderizar se ainda não existe
  if (document.getElementById('bottom-nav')) return;

  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  
  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.className = 'bottom-nav';
  
  const items = [
    { id: 'home', label: 'Home', icon: 'home', href: '/index.html', pages: ['index', ''] },
    { id: 'search', label: 'Search', icon: 'search', href: '/movies.html', pages: ['search'] },
    { id: 'movies', label: 'Movies', icon: 'movies', href: '/movies.html', pages: ['movies', 'movie', 'allmovie'] },
    { id: 'series', label: 'TV Shows', icon: 'tv', href: '/series.html', pages: ['series', 'serie', 'allserie', 'allseries'] },
    { id: 'profile', label: 'Profile', icon: 'profile', href: '/profile.html', pages: ['profile', 'settings', 'notifications'] }
  ];

  nav.innerHTML = items.map(item => {
    const isActive = item.pages.includes(currentPage);
    return `
      <a href="${item.href}" class="bottom-nav-item ${isActive ? 'active' : ''}" data-nav="${item.id}">
        ${getIcon(item.icon, isActive)}
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  document.body.appendChild(nav);
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

