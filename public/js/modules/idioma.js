// js/modules/idioma.js

import { saveUserPreferencesFirestore, getUserPreferencesFirestore } from "../firebase/firestore.js";
import { getCurrentUID } from "../firebase/auth.js";
import { isGuestMode } from "./guestMode.js";

const translations = {
  pt: {
    // Settings
    settings: "Definições",
    changePassword: "Alterar Palavra-passe",
    currentPassword: "Palavra-passe Atual",
    newPassword: "Nova Palavra-passe",
    confirmPassword: "Confirmar Nova Palavra-passe",
    enterCurrentPassword: "Introduza a palavra-passe atual",
    enterNewPassword: "Introduza a nova palavra-passe",
    confirmNewPassword: "Confirme a nova palavra-passe",
    changePasswordBtn: "Alterar Palavra-passe",
    language: "Idioma",
    selectLanguage: "Selecionar Idioma",
    portuguese: "Português",
    english: "Inglês",
    languageChanged: "Idioma alterado! A página será atualizada.",
    
    // Password Messages
    passwordChanged: "Palavra-passe alterada com sucesso!",
    fillAllFields: "Por favor, preencha todos os campos.",
    passwordsDontMatch: "As palavras-passe não coincidem.",
    passwordTooShort: "A nova palavra-passe deve ter pelo menos 6 caracteres.",
    passwordSame: "A nova palavra-passe deve ser diferente da atual.",
    mustBeLoggedIn: "Deve estar autenticado com uma conta de email para alterar a palavra-passe.",
    wrongPassword: "Palavra-passe atual incorreta.",
    weakPassword: "A nova palavra-passe é muito fraca.",
    requiresRecentLogin: "Por favor, faça logout e login novamente antes de alterar a palavra-passe.",
    anonymousUser: "Contas anónimas não podem alterar a palavra-passe.",
    userNotFound: "Utilizador não encontrado. Por favor, faça login novamente.",
    
    // Navbar
    home: "Início",
    movies: "Filmes",
    tvShows: "Séries",
    more: "Mais",
    searchMovies: "Pesquisar filmes",
    searchSeries: "Pesquisar séries",
    search: "Pesquisar...",
    stats: "Estatísticas",
    notifications: "Notificações",
    settings: "Definições",
    logout: "Sair",
    
    // Common
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    close: "Fechar",
    loading: "A carregar...",
    error: "Erro",
    success: "Sucesso",
    
    // Movies/Series
    addMovie: "Adicionar Filme",
    addSeries: "Adicionar Série",
    markAsViewed: "Marcar como Visto",
    viewed: "Visto",
    unmark: "Desmarcar",
    addMovieViaTMDB: "Adicionar Filme via TMDB",
    addSeriesViaTMDB: "Adicionar Série via TMDB",
    import: "Importar",
    saveOrderButton: "Guardar Ordem",
    reorderMoviesTitle: "Reorganizar Filmes",
    reorderMoviesDesc: "Arraste e solte para reorganizar. Todos os filmes estão visíveis abaixo.",
    reorderSeriesTitle: "Reorganizar Séries",
    reorderSeriesDesc: "Arraste e solte para reorganizar. Todas as séries estão visíveis abaixo.",
    noSeriesAvailable: "Nenhuma série disponível.",
    noSeriesFound: "Nenhuma série encontrada.",
    noSeriesWithFilters: "Nenhuma série encontrada com estes filtros.",
    noMoviesAvailable: "Nenhum filme disponível.",
    noMoviesFound: "Nenhum filme encontrado.",
    noSeriesSelected: "⚠️ Nenhuma série selecionada.",
    noMoviesSelected: "⚠️ Nenhum filme selecionado!",
    invalidMovie: "❌ Filme inválido.",
    movieNotFound: "❌ Filme não encontrado.",
    invalidSeries: "❌ Série inválida.",
    seriesNotFound: "❌ Série não encontrada.",
    typeAtLeastTwoChars: "Digite pelo menos 2 letras...",
    searching: "🔍 A procurar...",
    noResultsFound: "❌ Nenhum resultado encontrado.",

    // Toasts / mensagens
    orderSaved: "💾 Ordem guardada!",
    moviesRemoved: "🗑️ Filmes removidos!",
    seriesRemoved: "🗑️ Séries removidas!",
    cloudSynced: "🔄 Dados sincronizados da cloud.",
    seriesAlreadyInList: "❌ Esta série já está na sua lista!",
    seriesImportError: "❌ Erro ao importar série",
    movieAlreadyInList: "❌ Este filme já está na sua lista!",
    movieImportError: "Erro ao importar filme.",
    movieAddError: "Erro ao adicionar filme.",
    addedToFavorites: "Adicionada aos favoritos",
    removedFromFavorites: "Removida dos favoritos",
    addToFavorites: "Adicionar aos favoritos",
    removeFromFavorites: "Remover dos favoritos",
    
    // Pagination
    prev: "Anterior",
    next: "Seguinte",
    first: "Primeira",
    last: "Última",
    firstPage: "Primeira página",
    lastPage: "Última página",
    
    // Profile Button
    editProfile: "Editar Perfil",
    buttonColor: "Cor do Botão",
    initialLetter: "Letra Inicial",
    saveProfileSettings: "Guardar Definições do Perfil",
    profileSettingsSaved: "Definições do perfil guardadas!",
    
    // Page Titles
    myMovies: "Os Meus Filmes",
    allMovies: "Todos os Filmes",
    mySeries: "As Minhas Séries",
    allSeries: "Todas as Séries",
    searchResults: "Resultados da Pesquisa",
    settingsTitle: "Definições - A Minha Coleção",
    statsTitle: "Estatísticas",
    homeTitle: "Início",
    myCollection: "A Minha Coleção",
    installApp: "Instalar App",
    personalUse: "uso pessoal",
    terms: "Termos",
    privacy: "Privacidade",
    guestModeWarning: "Está em modo convidado. O progresso não será guardado.",
    
    // Filter & Actions
    filter: "Filtrar",
    filterMovies: "Filtrar Filmes",
    filterSeries: "Filtrar Séries",
    topRating: "Melhor Classificação",
    genre: "Género",
    lists: "Listas",
    year: "Ano",
    upcoming: "Próximos",
    applyTopRatingFilter: "Aplicar Filtro de Melhor Classificação",
    applyGenreFilter: "Aplicar Filtro de Género",
    applyListFilter: "Aplicar Filtro de Lista",
    applyYearFilter: "Aplicar Filtro de Ano",
    applyUpcomingFilter: "Aplicar Filtro de Próximos",
    clearAllFilters: "Limpar Todos os Filtros",
    selectGenres: "Selecionar Géneros",
    selectList: "Selecionar Lista",
    selectYear: "Selecionar Ano",
    enterYear: "Introduza o ano (ex: 2020)",
    releaseType: "Tipo de Lançamento",
    dateRange: "Intervalo de Datas",
    from: "de",
    to: "até",
    
    // Lists & States
    toWatch: "Para Ver",
    watching: "A Ver",
    watched: "Vistos",
    favorites: "Favoritos",
    
    // Informative Messages
    moviesSortedByRating: "Os filmes serão ordenados por classificação (maior para menor)",
    seriesSortedByRating: "As séries serão ordenadas por classificação (maior para menor)",
    errorSavingOrder: "Erro ao guardar ordem",
    
    // Movie Genres
    genreAction: "Ação",
    genreAdventure: "Aventura",
    genreAnimation: "Animação",
    genreComedy: "Comédia",
    genreCrime: "Crime",
    genreDocumentary: "Documentário",
    genreDrama: "Drama",
    genreFamily: "Família",
    genreFantasy: "Fantasia",
    genreHistory: "História",
    genreHorror: "Terror",
    genreMusic: "Música",
    genreMystery: "Mistério",
    genreRomance: "Romance",
    genreScienceFiction: "Ficção Científica",
    genreThriller: "Thriller",
    genreTVMovie: "Filme para TV",
    genreWar: "Guerra",
    genreWestern: "Faroeste",
    
    // Series Genres
    genreActionAdventure: "Ação e Aventura",
    genreKids: "Infantil",
    genreNews: "Notícias",
    genreReality: "Reality Show",
    genreSciFiFantasy: "Ficção Científica e Fantasia",
    genreSoap: "Novela",
    genreTalk: "Talk Show",
    genreWarPolitics: "Guerra e Política",
    
    // Release Types
    releaseTheatricalLimited: "Cinema (Limitado)",
    releaseTheatrical: "Cinema",
    releasePremiere: "Estreia",
    
    // Search Page Messages
    noMoreMoviesFound: "Não foram encontrados mais filmes.",
    noMoreSeriesFound: "Não foram encontradas mais séries.",
    errorLoadingMovies: "Erro ao carregar filmes.",
    errorLoadingSeries: "Erro ao carregar séries.",
    startTypingToSearch: "Comece a escrever para pesquisar...",
    searchingMovies: "A pesquisar filmes...",
    searchingSeries: "A pesquisar séries...",
    noMoviesFound: "Nenhum filme encontrado.",
    noSeriesFound: "Nenhuma série encontrada.",
    noMoviesFoundWithFilters: "Nenhum filme encontrado com estes filtros.",
    noSeriesFoundWithFilters: "Nenhuma série encontrada com estes filtros.",
    errorSearchingMovies: "Erro ao pesquisar filmes.",
    errorSearchingSeries: "Erro ao pesquisar séries.",
    noSearchQueryProvided: "Nenhuma pesquisa fornecida.",
    
    // Movie/Series Details
    year: "Ano",
    genre: "Género",
    tvStatus: "Estado da Série",
    noDescriptionAvailable: "Sem descrição disponível.",
    progress: "Progresso",
    episodes: "episódios",
    episode: "episódio",
    season: "Temporada",
    episodeTitle: "Episódio",
    follow: "Seguir",
    unfollow: "Deixar de Seguir",
    clearAll: "Limpar Tudo",
    notificationsTitle: "Notificações",
    statsTitle: "Estatísticas",
    
    // Stats Page
    totalAdded: "Total adicionado",
    stillWatching: "A ver",
    totalEpisodesWatched: "Total de episódios vistos",
    inTheLast7Days: "nos últimos 7 dias",
    timeSpentWatchingEpisodes: "Tempo gasto a ver episódios",
    timeSpentWatchingMovies: "Tempo gasto a ver filmes",
    hours: "horas",
    mainGenresOfSeries: "Principais géneros de séries",
    mainGenresOfMovies: "Principais géneros de filmes",
    noGenreDataAvailable: "Ainda não há dados de géneros disponíveis.",
    totalMoviesWatched: "Total de filmes vistos",
    genreLabel: "Género",
    seriesLabel: "Séries",
    moviesLabel: "Filmes",
    
    // Home Page
    myPersonalLibrary: "A minha biblioteca pessoal de",
    exploreBookmarkTrack: "Explora, marca e acompanha o teu progresso.",
    watchMovies: "Ver Filmes",
    watchTVShows: "Ver Séries",
    viewDetails: "Ver detalhes",
    
    // Notifications
    noNotificationsYet: "Ainda não há notificações. Quando novos episódios forem adicionados às tuas séries, aparecerão aqui.",
    episodesAdded: "episódios adicionados",
    noEpisodesListed: "Nenhum episódio listado.",
    unknownMovie: "Filme desconhecido",
    unknownSeries: "Série desconhecida",
    noSeasonsAvailable: "Nenhuma temporada disponível. Os dados da série serão carregados do TMDB.",
    noEpisodesAvailable: "Nenhum episódio disponível",
    errorUpdatingFavorites: "Erro ao atualizar favoritos. Por favor, tenta novamente.",
    errorUpdatingFollowing: "Erro ao atualizar lista de seguimento. Por favor, tenta novamente.",
    removedFromFollowing: "Removido da lista de seguimento",
    addedToFollowing: "Adicionado à lista de seguimento",
    months: "meses",
    days: "dias",
  },
  en: {
    // Settings
    settings: "Settings",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    enterCurrentPassword: "Enter current password",
    enterNewPassword: "Enter new password",
    confirmNewPassword: "Confirm new password",
    changePasswordBtn: "Change Password",
    language: "Language",
    selectLanguage: "Select Language",
    portuguese: "Portuguese",
    english: "English",
    languageChanged: "Language changed! The page will be refreshed.",
    
    // Password Messages
    passwordChanged: "Password changed successfully!",
    fillAllFields: "Please fill in all fields.",
    passwordsDontMatch: "New passwords do not match.",
    passwordTooShort: "New password must be at least 6 characters.",
    passwordSame: "New password must be different from current password.",
    mustBeLoggedIn: "You must be logged in with an email account to change password.",
    wrongPassword: "Current password is incorrect.",
    weakPassword: "New password is too weak.",
    requiresRecentLogin: "Please log out and log in again before changing password.",
    anonymousUser: "Anonymous accounts cannot change password.",
    userNotFound: "User not found. Please log in again.",
    
    // Navbar
    home: "Home",
    movies: "Movies",
    tvShows: "TV Shows",
    more: "More",
    searchMovies: "Search for movies",
    searchSeries: "Search for TV shows",
    search: "Search...",
    stats: "Stats",
    notifications: "Notifications",
    settings: "Settings",
    logout: "Logout",
    
    // Common
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    
    // Movies/Series
    addMovie: "Add Movie",
    addSeries: "Add Series",
    markAsViewed: "Mark as Viewed",
    viewed: "Viewed",
    unmark: "Unmark",
    addMovieViaTMDB: "Add Movie via TMDB",
    addSeriesViaTMDB: "Add Series via TMDB",
    import: "Import",
    saveOrderButton: "Save Order",
    reorderMoviesTitle: "Reorder Movies",
    reorderMoviesDesc: "Drag and drop to reorder. All movies are visible below.",
    reorderSeriesTitle: "Reorder Series",
    reorderSeriesDesc: "Drag and drop to reorder. All series are visible below.",
    noSeriesAvailable: "No series available.",
    noSeriesFound: "No series found.",
    noSeriesWithFilters: "No series found with these filters.",
    noMoviesAvailable: "No movies available.",
    noMoviesFound: "No movies found.",
    noSeriesSelected: "⚠️ No series selected.",
    noMoviesSelected: "⚠️ No movies selected!",
    invalidMovie: "❌ Invalid movie.",
    movieNotFound: "❌ Movie not found.",
    invalidSeries: "❌ Invalid series.",
    seriesNotFound: "❌ Series not found.",
    typeAtLeastTwoChars: "Type at least 2 characters...",
    searching: "🔍 Searching...",
    noResultsFound: "❌ No results found.",

    // Toasts / messages
    orderSaved: "💾 Order saved!",
    moviesRemoved: "🗑️ Movies removed!",
    seriesRemoved: "🗑️ Series removed!",
    cloudSynced: "🔄 Data synced from the cloud.",
    seriesAlreadyInList: "❌ This series is already in your list!",
    seriesImportError: "❌ Error importing series",
    movieAlreadyInList: "❌ This movie is already in your list!",
    movieImportError: "Error importing movie.",
    movieAddError: "Error adding movie.",
    addedToFavorites: "Added to favorites",
    removedFromFavorites: "Removed from favorites",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",
    
    // Pagination
    prev: "Prev",
    next: "Next",
    first: "First",
    last: "Last",
    firstPage: "First page",
    lastPage: "Last page",
    
    // Profile Button
    editProfile: "Edit Profile",
    buttonColor: "Button Color",
    initialLetter: "Initial Letter",
    saveProfileSettings: "Save Profile Settings",
    profileSettingsSaved: "Profile settings saved!",
    
    // Page Titles
    myMovies: "My Movies",
    allMovies: "All Movies",
    mySeries: "My Series",
    allSeries: "All Series",
    searchResults: "Search Results",
    settingsTitle: "Settings - My Collection",
    statsTitle: "Stats",
    homeTitle: "Home",
    myCollection: "My Collection",
    installApp: "Install App",
    personalUse: "personal use",
    terms: "Terms",
    privacy: "Privacy",
    guestModeWarning: "You are in guest mode. Progress will not be saved.",
    
    // Filter & Actions
    filter: "Filter",
    filterMovies: "Filter Movies",
    filterSeries: "Filter Series",
    topRating: "Top Rating",
    genre: "Genre",
    lists: "Lists",
    year: "Year",
    upcoming: "Upcoming",
    applyTopRatingFilter: "Apply Top Rating Filter",
    applyGenreFilter: "Apply Genre Filter",
    applyListFilter: "Apply List Filter",
    applyYearFilter: "Apply Year Filter",
    applyUpcomingFilter: "Apply Upcoming Filter",
    clearAllFilters: "Clear All Filters",
    selectGenres: "Select Genres",
    selectList: "Select List",
    selectYear: "Select Year",
    enterYear: "Enter year (e.g., 2020)",
    releaseType: "Release Type",
    dateRange: "Date Range",
    from: "from",
    to: "to",
    
    // Lists & States
    toWatch: "To Watch",
    watching: "Watching",
    watched: "Watched",
    favorites: "Favorites",
    
    // Informative Messages
    moviesSortedByRating: "Movies will be sorted by rating (highest to lowest)",
    seriesSortedByRating: "Series will be sorted by rating (highest to lowest)",
    errorSavingOrder: "Error saving order",
    
    // Movie Genres
    genreAction: "Action",
    genreAdventure: "Adventure",
    genreAnimation: "Animation",
    genreComedy: "Comedy",
    genreCrime: "Crime",
    genreDocumentary: "Documentary",
    genreDrama: "Drama",
    genreFamily: "Family",
    genreFantasy: "Fantasy",
    genreHistory: "History",
    genreHorror: "Horror",
    genreMusic: "Music",
    genreMystery: "Mystery",
    genreRomance: "Romance",
    genreScienceFiction: "Science Fiction",
    genreThriller: "Thriller",
    genreTVMovie: "TV Movie",
    genreWar: "War",
    genreWestern: "Western",
    
    // Series Genres
    genreActionAdventure: "Action & Adventure",
    genreKids: "Kids",
    genreNews: "News",
    genreReality: "Reality",
    genreSciFiFantasy: "Sci-Fi & Fantasy",
    genreSoap: "Soap",
    genreTalk: "Talk",
    genreWarPolitics: "War & Politics",
    
    // Release Types
    releaseTheatricalLimited: "Theatrical (Limited)",
    releaseTheatrical: "Theatrical",
    releasePremiere: "Premiere",
    
    // Search Page Messages
    noMoreMoviesFound: "No more movies found.",
    noMoreSeriesFound: "No more series found.",
    errorLoadingMovies: "Error loading movies.",
    errorLoadingSeries: "Error loading series.",
    startTypingToSearch: "Start typing to search...",
    searchingMovies: "Searching movies...",
    searchingSeries: "Searching series...",
    noMoviesFound: "No movies found.",
    noSeriesFound: "No series found.",
    noMoviesFoundWithFilters: "No movies found with these filters.",
    noSeriesFoundWithFilters: "No series found with these filters.",
    errorSearchingMovies: "Error searching movies.",
    errorSearchingSeries: "Error searching series.",
    noSearchQueryProvided: "No search query provided.",
    
    // Movie/Series Details
    year: "Year",
    genre: "Genre",
    tvStatus: "TV Status",
    noDescriptionAvailable: "No description available.",
    progress: "Progress",
    episodes: "episodes",
    episode: "episode",
    season: "Season",
    episodeTitle: "Episode",
    follow: "Follow",
    unfollow: "Unfollow",
    clearAll: "Clear all",
    notificationsTitle: "Notifications",
    statsTitle: "Stats",
    
    // Stats Page
    totalAdded: "Total added",
    stillWatching: "still watching",
    totalEpisodesWatched: "Total episodes watched",
    inTheLast7Days: "in the last 7 days",
    timeSpentWatchingEpisodes: "Time spent watching episodes",
    timeSpentWatchingMovies: "Time spent watching movies",
    hours: "hours",
    mainGenresOfSeries: "Main genres of series",
    mainGenresOfMovies: "Main genres of movies",
    noGenreDataAvailable: "No genre data available yet.",
    totalMoviesWatched: "Total movies watched",
    genreLabel: "Genre",
    seriesLabel: "Series",
    moviesLabel: "Movies",
    
    // Home Page
    myPersonalLibrary: "My personal library of",
    exploreBookmarkTrack: "Explore, bookmark, and track your progress.",
    watchMovies: "Watch Movies",
    watchTVShows: "Watch TV Shows",
    viewDetails: "View details",
    
    // Notifications
    noNotificationsYet: "No notifications yet. When new episodes are added to your series, they will appear here.",
    episodesAdded: "episodes added",
    noEpisodesListed: "No episodes listed.",
    unknownMovie: "Unknown movie",
    unknownSeries: "Unknown series",
    noSeasonsAvailable: "No seasons available. The series data will be loaded from TMDB.",
    noEpisodesAvailable: "No episodes available",
    errorUpdatingFavorites: "Error updating favorites. Please try again.",
    errorUpdatingFollowing: "Error updating following list. Please try again.",
    removedFromFollowing: "Removed from following",
    addedToFollowing: "Added to following",
    months: "months",
    days: "days",
  }
};

let currentLang = 'en';
let preferencesLoaded = false;

// Carregar preferências do utilizador (Firestore ou localStorage como fallback)
export async function loadUserPreferences() {
  if (preferencesLoaded) return;
  
  // Em modo convidado, sempre usar inglês
  if (isGuestMode()) {
    currentLang = 'en';
    preferencesLoaded = true;
    if (document.documentElement) {
      document.documentElement.lang = 'en';
    }
    return;
  }
  
  const uid = getCurrentUID();
  
  if (uid) {
    // Tentar carregar do Firestore
    try {
      const prefs = await getUserPreferencesFirestore();
      if (prefs && prefs.language) {
        currentLang = prefs.language;
        preferencesLoaded = true;
        if (document.documentElement) {
          document.documentElement.lang = currentLang;
        }
        return;
      }
    } catch (err) {
      console.warn("Could not load preferences from Firestore:", err);
    }
  }
  
  // Fallback para localStorage
  const savedLang = localStorage.getItem('language');
  if (savedLang && translations[savedLang]) {
    currentLang = savedLang;
  }
  
  preferencesLoaded = true;
  if (document.documentElement) {
    document.documentElement.lang = currentLang;
  }
}

export function getLanguage() {
  return currentLang;
}

export async function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    
    const uid = getCurrentUID();
    
    if (uid) {
      // Guardar no Firestore
      try {
        await saveUserPreferencesFirestore({ language: lang });
      } catch (err) {
        console.warn("Could not save language to Firestore:", err);
        // Fallback para localStorage
        localStorage.setItem('language', lang);
      }
    } else {
      // Se não houver utilizador autenticado, usar localStorage
      localStorage.setItem('language', lang);
    }
    
    if (document.documentElement) {
      document.documentElement.lang = lang;
    }
    
    // Disparar evento para atualizar UI
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    
    return true;
  }
  return false;
}

export function t(key, fallback = '') {
  return translations[currentLang]?.[key] || translations['en']?.[key] || fallback || key;
}

// Inicializar idioma ao carregar (será carregado quando loadUserPreferences for chamado)
// Por agora, usar localStorage como fallback inicial (padrão: inglês)
if (typeof document !== 'undefined' && document.documentElement) {
  // Verificar se está em modo convidado (import dinâmico para evitar circular)
  const guestModeActive = sessionStorage.getItem('guest_mode_active') === 'true';
  
  if (guestModeActive) {
    // Em modo convidado, sempre inglês
    currentLang = 'en';
  } else {
    const savedLang = localStorage.getItem('language');
    if (savedLang && translations[savedLang]) {
      currentLang = savedLang;
    } else {
      currentLang = 'en'; // Padrão: inglês
    }
  }
  document.documentElement.lang = currentLang;
}

