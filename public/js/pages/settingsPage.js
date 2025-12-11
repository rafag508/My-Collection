import { renderNavbar } from "../ui/navbar.js";
import { renderFooter } from "../ui/footer.js";
import { changePassword, getCurrentUser } from "../firebase/auth.js";
import { t, getLanguage, setLanguage, loadUserPreferences } from "../modules/idioma.js";
import { saveUserPreferencesFirestore, getUserPreferencesFirestore } from "../firebase/firestore.js";
import { getCurrentUID } from "../firebase/auth.js";
import { isGuestMode } from "../modules/guestMode.js";

export async function initSettingsPage() {
  // Bloquear acesso em modo convidado (segurança extra)
  if (isGuestMode()) {
    alert("O modo convidado não tem acesso às definições. Por favor, cria uma conta.");
    window.location.href = "./index.html";
    return;
  }
  
  renderNavbar();
  renderFooter();
  
  // Carregar preferências do utilizador
  await loadUserPreferences();
  
  // Aplicar traduções iniciais
  applyTranslations();
  
  // Configurar selector de idioma
  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    languageSelect.value = getLanguage();
    languageSelect.addEventListener("change", async (e) => {
      await setLanguage(e.target.value);
      applyTranslations();
      // Recarregar navbar e footer com novo idioma
      renderNavbar();
      renderFooter();
      // Mostrar mensagem de sucesso ao lado do título
      showLanguageMessage(t("languageChanged"), "success");
      // Recarregar página após um pequeno delay para aplicar todas as traduções
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  }
  
  // Configurar personalização do perfil
  setupProfileCustomization();
  
  // Obter utilizador autenticado
  const currentUser = getCurrentUser();
  const changePasswordCard = document.querySelector("#changePasswordForm")?.closest(".bg-gray-900\\/70");
  
  // Verificar se o utilizador é anónimo ou não tem email
  if (!currentUser || currentUser.isAnonymous || !currentUser.email) {
    if (changePasswordCard) {
      // Esconder o card de mudança de password para utilizadores anónimos
      changePasswordCard.style.display = "none";
    }
    return; // Não inicializar o formulário se for anónimo
  }
  
  const form = document.getElementById("changePasswordForm");
  const msgEl = document.getElementById("changePasswordMsg");
  
  // Toggle buttons para mostrar/esconder passwords
  const toggleCurrentPasswordBtn = document.getElementById("toggleCurrentPassword");
  const toggleNewPasswordBtn = document.getElementById("toggleNewPassword");
  const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPassword");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  
  // Toggle para Current Password
  if (toggleCurrentPasswordBtn && currentPasswordInput) {
    toggleCurrentPasswordBtn.addEventListener("click", () => {
      const type = currentPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      currentPasswordInput.setAttribute("type", type);
      const eyeIcon = document.getElementById("eyeIconCurrent");
      const eyeOffIcon = document.getElementById("eyeOffIconCurrent");
      if (type === "text") {
        eyeIcon.classList.add("hidden");
        eyeOffIcon.classList.remove("hidden");
      } else {
        eyeIcon.classList.remove("hidden");
        eyeOffIcon.classList.add("hidden");
      }
    });
  }
  
  // Toggle para New Password
  if (toggleNewPasswordBtn && newPasswordInput) {
    toggleNewPasswordBtn.addEventListener("click", () => {
      const type = newPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      newPasswordInput.setAttribute("type", type);
      const eyeIcon = document.getElementById("eyeIconNew");
      const eyeOffIcon = document.getElementById("eyeOffIconNew");
      if (type === "text") {
        eyeIcon.classList.add("hidden");
        eyeOffIcon.classList.remove("hidden");
      } else {
        eyeIcon.classList.remove("hidden");
        eyeOffIcon.classList.add("hidden");
      }
    });
  }
  
  // Toggle para Confirm Password
  if (toggleConfirmPasswordBtn && confirmPasswordInput) {
    toggleConfirmPasswordBtn.addEventListener("click", () => {
      const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      confirmPasswordInput.setAttribute("type", type);
      const eyeIcon = document.getElementById("eyeIconConfirm");
      const eyeOffIcon = document.getElementById("eyeOffIconConfirm");
      if (type === "text") {
        eyeIcon.classList.add("hidden");
        eyeOffIcon.classList.remove("hidden");
      } else {
        eyeIcon.classList.remove("hidden");
        eyeOffIcon.classList.add("hidden");
      }
    });
  }
  
  if (!form) return;
  
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Verificar novamente o utilizador autenticado (pode ter mudado)
    const user = getCurrentUser();
    if (!user || !user.email || user.isAnonymous) {
      showMessage(t("mustBeLoggedIn"), "error");
      return;
    }
    
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage(t("fillAllFields"), "error");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showMessage(t("passwordsDontMatch"), "error");
      return;
    }
    
    if (newPassword.length < 6) {
      showMessage(t("passwordTooShort"), "error");
      return;
    }
    
    if (currentPassword === newPassword) {
      showMessage(t("passwordSame"), "error");
      return;
    }
    
    // Usar a função changePassword que já usa auth.currentUser internamente
    const res = await changePassword(currentPassword, newPassword);
    
    if (!res.ok) {
      const errorMsg = formatError(res.error);
      showMessage(errorMsg, "error");
      return;
    }
    
    showMessage(t("passwordChanged"), "success");
    
    // Limpar todos os campos de password explicitamente
    const currentPasswordInput = document.getElementById("currentPassword");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    
    // Limpar valores
    if (currentPasswordInput) {
      currentPasswordInput.value = "";
      currentPasswordInput.setAttribute("type", "password");
      // Restaurar readonly para prevenir autofill novamente
      currentPasswordInput.setAttribute("readonly", "");
      currentPasswordInput.setAttribute("aria-readonly", "true");
    }
    if (newPasswordInput) {
      newPasswordInput.value = "";
      newPasswordInput.setAttribute("type", "password");
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.value = "";
      confirmPasswordInput.setAttribute("type", "password");
    }
    
    // Resetar os ícones de olho para o estado inicial (fechado)
    const eyeIconCurrent = document.getElementById("eyeIconCurrent");
    const eyeOffIconCurrent = document.getElementById("eyeOffIconCurrent");
    if (eyeIconCurrent && eyeOffIconCurrent) {
      eyeIconCurrent.classList.remove("hidden");
      eyeOffIconCurrent.classList.add("hidden");
    }
    
    const eyeIconNew = document.getElementById("eyeIconNew");
    const eyeOffIconNew = document.getElementById("eyeOffIconNew");
    if (eyeIconNew && eyeOffIconNew) {
      eyeIconNew.classList.remove("hidden");
      eyeOffIconNew.classList.add("hidden");
    }
    
    const eyeIconConfirm = document.getElementById("eyeIconConfirm");
    const eyeOffIconConfirm = document.getElementById("eyeOffIconConfirm");
    if (eyeIconConfirm && eyeOffIconConfirm) {
      eyeIconConfirm.classList.remove("hidden");
      eyeOffIconConfirm.classList.add("hidden");
    }
    
    // Forçar blur nos campos para garantir que o browser não guarda os valores
    if (currentPasswordInput) currentPasswordInput.blur();
    if (newPasswordInput) newPasswordInput.blur();
    if (confirmPasswordInput) confirmPasswordInput.blur();
    
    // Reset do formulário
    form.reset();
  });
  
  function showMessage(msg, type) {
    if (!msgEl) return;
    
    msgEl.textContent = msg;
    msgEl.className = `mb-4 p-3 rounded-lg ${
      type === "error" 
        ? "bg-red-900/20 border border-red-500/30 text-red-400"
        : "bg-green-900/20 border border-green-500/30 text-green-400"
    }`;
    msgEl.classList.remove("hidden");
    
    setTimeout(() => {
      msgEl.classList.add("hidden");
    }, 5000);
  }
  
  function showLanguageMessage(msg, type) {
    const languageMsgEl = document.getElementById("languageChangeMsg");
    if (!languageMsgEl) return;
    
    languageMsgEl.textContent = msg;
    languageMsgEl.className = `text-base font-medium px-4 py-2 rounded-lg ml-4 ${
      type === "error" 
        ? "bg-red-900/20 border border-red-500/30 text-red-400"
        : "bg-green-900/20 border border-green-500/30 text-green-400"
    }`;
    languageMsgEl.classList.remove("hidden");
    
    setTimeout(() => {
      languageMsgEl.classList.add("hidden");
    }, 3000);
  }
  
  function formatError(errCode) {
    switch (errCode) {
      case "auth/wrong-password": return t("wrongPassword");
      case "auth/weak-password": return t("weakPassword");
      case "auth/requires-recent-login": return t("requiresRecentLogin");
      case "auth/anonymous-user": return t("anonymousUser");
      case "auth/user-not-found": return t("userNotFound");
      default: return t("error") + ": " + errCode;
    }
  }
  
  function applyTranslations() {
    // Atualizar atributo lang do HTML
    const currentLang = getLanguage();
    if (document.documentElement) {
      document.documentElement.lang = currentLang;
    }
    
    // Aplicar traduções a elementos com data-i18n
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const translation = t(key);
      
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        if (el.hasAttribute("placeholder")) {
          el.placeholder = translation;
        } else {
          el.value = translation;
        }
      } else if (el.tagName === "OPTION") {
        // Para options, manter o valor mas atualizar o texto
        if (el.textContent.trim() !== "") {
          el.textContent = translation;
        }
      } else if (el.tagName === "BUTTON" || el.tagName === "A") {
        el.textContent = translation;
      } else {
        el.textContent = translation;
      }
    });
    
    // Aplicar placeholders com data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });
    
    // Atualizar título da página
    const settingsTitle = document.querySelector("h1[data-i18n='settings']");
    if (settingsTitle) {
      document.title = t("settings") + " - My Collection";
    }
  }
  
  async function setupProfileCustomization() {
    // Carregar preferências guardadas
    let savedColor = 'cyan';
    let savedLetter = 'R';
    
    const uid = getCurrentUID();
    
    if (uid) {
      // Tentar carregar do Firestore
      try {
        const prefs = await getUserPreferencesFirestore();
        if (prefs) {
          savedColor = prefs.profileButtonColor || 'cyan';
          savedLetter = prefs.profileButtonLetter || 'R';
        }
      } catch (err) {
        console.warn("Could not load profile preferences from Firestore:", err);
        // Fallback para localStorage
        savedColor = localStorage.getItem('profileButtonColor') || 'cyan';
        savedLetter = localStorage.getItem('profileButtonLetter') || 'R';
      }
    } else {
      // Se não houver utilizador, usar localStorage
      savedColor = localStorage.getItem('profileButtonColor') || 'cyan';
      savedLetter = localStorage.getItem('profileButtonLetter') || 'R';
    }
    
    const colorSelect = document.getElementById("profileColorSelect");
    const letterInput = document.getElementById("profileLetterInput");
    const saveBtn = document.getElementById("saveProfileBtn");
    
    if (colorSelect) {
      colorSelect.value = savedColor;
    }
    
    if (letterInput) {
      letterInput.value = savedLetter;
      // Converter para maiúscula automaticamente
      letterInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase().slice(0, 1);
      });
    }
    
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const color = colorSelect?.value || 'cyan';
        const letter = letterInput?.value.toUpperCase().slice(0, 1) || 'R';
        
        const uid = getCurrentUID();
        
        if (uid) {
          // Guardar no Firestore
          try {
            await saveUserPreferencesFirestore({
              profileButtonColor: color,
              profileButtonLetter: letter
            });
          } catch (err) {
            console.warn("Could not save profile preferences to Firestore:", err);
            // Fallback para localStorage
            localStorage.setItem('profileButtonColor', color);
            localStorage.setItem('profileButtonLetter', letter);
          }
        } else {
          // Se não houver utilizador, usar localStorage
          localStorage.setItem('profileButtonColor', color);
          localStorage.setItem('profileButtonLetter', letter);
        }
        
        // Recarregar navbar para aplicar mudanças
        renderNavbar();
        
        // Mostrar mensagem de sucesso
        showLanguageMessage(t("profileSettingsSaved"), "success");
      });
    }
  }
}

