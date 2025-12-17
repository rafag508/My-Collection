// profilePage.js - Página de perfil estilo Netflix
import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { logout, getCurrentUser } from "../firebase/auth.js";
import { getUserPreferencesFirestore } from "../firebase/firestore.js";
import { getNotifications } from "../modules/notifications.js";
import { storageService } from "../modules/storageService.js";
import { getSerieById, getAllSeries } from "../modules/series/seriesDataManager.js";
import { getMovieById, getAllMovies } from "../modules/movies/moviesDataManager.js";
import { loadProgress as loadSeriesProgress, countWatchedEpisodes } from "../modules/series/seriesProgress.js";
import { loadProgress as loadMoviesProgress } from "../modules/movies/moviesProgress.js";

const EPISODE_AVG_MIN = 45;
const MOVIE_AVG_MIN = 120;

export async function initProfilePage() {
  renderNavbar();
  renderFooter();
  
  setupMenuToggle();
  setupLogout();
  await loadUserInfo();
  await loadNotificationsPreview();
  await loadStatsPreview();
}

// Menu slide-up toggle
function setupMenuToggle() {
  const menuBtn = document.getElementById('menuToggleBtn');
  const menu = document.getElementById('slideMenu');
  const overlay = document.getElementById('slideMenuOverlay');
  
  if (!menuBtn || !menu || !overlay) return;
  
  menuBtn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
    overlay.classList.toggle('hidden');
  });
  
  overlay.addEventListener('click', () => {
    menu.classList.add('hidden');
    overlay.classList.add('hidden');
  });
}

// Logout
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.href = '/login.html';
    });
  }
}

// User info (avatar, email)
async function loadUserInfo() {
  const user = getCurrentUser();
  const emailEl = document.getElementById('userEmail');
  const avatarLetter = document.getElementById('avatarLetter');
  const avatarBox = document.getElementById('avatarBox');
  
  if (emailEl && user?.email) {
    emailEl.textContent = user.email;
  }
  
  // Load preferences for avatar
  try {
    const prefs = await getUserPreferencesFirestore();
    if (prefs) {
      if (avatarLetter && prefs.profileLetter) {
        avatarLetter.textContent = prefs.profileLetter.toUpperCase();
      }
      if (avatarBox && prefs.profileColor) {
        avatarBox.style.backgroundColor = getColorHex(prefs.profileColor);
      }
    }
  } catch (err) {
    console.warn('Error loading user preferences:', err);
  }
}

function getColorHex(colorName) {
  const colors = {
    cyan: '#06b6d4',
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    pink: '#ec4899',
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    indigo: '#6366f1',
    teal: '#14b8a6',
    gray: '#6b7280'
  };
  return colors[colorName] || colors.blue;
}

// Notifications preview (horizontal scroll)
async function loadNotificationsPreview() {
  const container = document.getElementById('notificationsScroll');
  const countBadge = document.getElementById('notifCount');
  if (!container) return;
  
  try {
    const notifications = await getNotifications();
    const unread = notifications.filter(n => !n.read);
    
    if (countBadge && unread.length > 0) {
      countBadge.textContent = unread.length;
      countBadge.classList.remove('hidden');
    }
    
    if (notifications.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-lg px-4">No notifications</p>';
      return;
    }
    
    // Show last 10 notifications
    const recent = notifications.slice(0, 10);
    const cards = await Promise.all(recent.map(async (notif) => {
      let posterUrl = '/assets/icons/mc-icon-blue.svg';
      let title = notif.title || 'Notification';
      
      // Get poster from serie or movie
      if (notif.type === 'movie_release' && notif.movieId) {
        try {
          const movie = await getMovieById(notif.movieId);
          posterUrl = movie?.poster || notif.moviePoster || posterUrl;
          title = notif.movieTitle || movie?.title || title;
        } catch (e) {}
      } else if (notif.serieId) {
        try {
          const serie = await getSerieById(notif.serieId);
          posterUrl = serie?.poster || notif.seriePoster || '/assets/icons/mc-icon-green.svg';
          title = notif.serieName || serie?.title || title;
        } catch (e) {}
      }
      
      return `
        <div class="notif-card ${notif.read ? '' : 'unread'}">
          <img src="${posterUrl}" 
               alt="" class="notif-poster" 
               onerror="this.src='/assets/icons/mc-icon-blue.svg'">
          <div class="notif-content">
            <p class="notif-title">${title}</p>
            <p class="notif-msg">${notif.message || ''}</p>
          </div>
        </div>
      `;
    }));
    
    container.innerHTML = cards.join('');
  } catch (err) {
    console.warn('Error loading notifications:', err);
    container.innerHTML = '<p class="text-gray-500 text-lg px-4">Failed to load</p>';
  }
}

// Stats preview (4 cards)
async function loadStatsPreview() {
  const tvTimeEl = document.getElementById('statTvTime');
  const episodesEl = document.getElementById('statEpisodes');
  const movieTimeEl = document.getElementById('statMovieTime');
  const moviesEl = document.getElementById('statMovies');
  
  try {
    // Use the same functions as statsPage for accurate data
    const [series, movies, seriesProgressMap, moviesProgressMap] = await Promise.all([
      getAllSeries(),
      getAllMovies(),
      loadSeriesProgress(),
      loadMoviesProgress()
    ]);
    
    // Count episodes watched using the same function as statsPage
    let episodesWatched = 0;
    if (Array.isArray(series)) {
      series.forEach(serie => {
        const progress = seriesProgressMap[serie.id] || { watched: {} };
        try {
          const info = countWatchedEpisodes(serie, progress);
          episodesWatched += info.watched || 0;
        } catch (err) {
          // Ignore errors for individual series
        }
      });
    }
    
    // Count movies watched
    let moviesWatched = 0;
    Object.values(moviesProgressMap || {}).forEach(data => {
      if (data.watched) moviesWatched++;
    });
    
    // Calculate times
    const tvMinutes = episodesWatched * EPISODE_AVG_MIN;
    const movieMinutes = moviesWatched * MOVIE_AVG_MIN;
    
    // Update UI with new format
    if (tvTimeEl) updateTimeCard(tvTimeEl, tvMinutes);
    if (episodesEl) {
      const singleEl = episodesEl.querySelector('.stat-single');
      if (singleEl) singleEl.textContent = episodesWatched.toLocaleString();
    }
    if (movieTimeEl) updateTimeCard(movieTimeEl, movieMinutes);
    if (moviesEl) {
      const singleEl = moviesEl.querySelector('.stat-single');
      if (singleEl) singleEl.textContent = moviesWatched.toLocaleString();
    }
    
  } catch (err) {
    console.warn('Error loading stats:', err);
  }
}

function updateTimeCard(container, totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  
  const remainingDays = days % 30;
  const remainingHours = hours % 24;
  
  const monthsEl = container.querySelector('[data-months]');
  const daysEl = container.querySelector('[data-days]');
  const hoursEl = container.querySelector('[data-hours]');
  
  if (monthsEl) monthsEl.textContent = months;
  if (daysEl) daysEl.textContent = remainingDays;
  if (hoursEl) hoursEl.textContent = remainingHours;
}

// Auto-init
initProfilePage();

