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
    
    // Pagination
    prev: "Anterior",
    next: "Seguinte",
    first: "Primeira",
    last: "Última",
    
    // Profile Button
    editProfile: "Editar Perfil",
    buttonColor: "Cor do Botão",
    initialLetter: "Letra Inicial",
    saveProfileSettings: "Guardar Definições do Perfil",
    profileSettingsSaved: "Definições do perfil guardadas!",
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
    
    // Pagination
    prev: "Prev",
    next: "Next",
    first: "First",
    last: "Last",
    
    // Profile Button
    editProfile: "Edit Profile",
    buttonColor: "Button Color",
    initialLetter: "Initial Letter",
    saveProfileSettings: "Save Profile Settings",
    profileSettingsSaved: "Profile settings saved!",
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

