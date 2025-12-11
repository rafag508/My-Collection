import { login, sendPasswordReset, register } from "../firebase/auth.js";
import { enableGuestMode } from "../modules/guestMode.js";

// ✅ Códigos secretos removidos - agora validados no backend via Vercel Serverless Functions

const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const togglePasswordBtn = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");
const eyeOffIcon = document.getElementById("eyeOffIcon");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const createAccountBtn = document.getElementById("createAccountBtn");
const createAccountModal = document.getElementById("createAccountModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const createAccountForm = document.getElementById("createAccountForm");
const createAccountErrorMsg = document.getElementById("createAccountErrorMsg");
const form = document.getElementById("loginForm");

// Elementos do modal de código de acesso ao modo convidado
const guestCodeModal = document.getElementById("guestCodeModal");
const guestCodeInput = document.getElementById("guestCodeInput");
const guestCodeErrorMsg = document.getElementById("guestCodeErrorMsg");
const guestCodeSubmitBtn = document.getElementById("guestCodeSubmitBtn");
const closeGuestCodeModalBtn = document.getElementById("closeGuestCodeModalBtn");

// ✅ SECRET_CODE removido - agora validado no backend via Firebase Functions

// Chave para guardar o email no localStorage
const SAVED_EMAIL_KEY = "savedLoginEmail";

// Carregar email guardado quando a página carrega
function loadSavedEmail() {
  if (emailInput) {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      emailInput.value = savedEmail;
    }
  }
}

// Guardar email quando login for bem-sucedido
function saveEmail(email) {
  if (email) {
    localStorage.setItem(SAVED_EMAIL_KEY, email);
  }
}

// Carregar email guardado ao carregar a página
loadSavedEmail();

// Toggle para mostrar/esconder password
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    
    if (type === "text") {
      eyeIcon.classList.add("hidden");
      eyeOffIcon.classList.remove("hidden");
    } else {
      eyeIcon.classList.remove("hidden");
      eyeOffIcon.classList.add("hidden");
    }
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showError("Preenche todos os campos.");
    return;
  }
  const res = await login(email, password);
  if (!res.ok) {
    showError(formatError(res.error));
    return;
  }
  // Login bem-sucedido - guardar email e redirecionar
  saveEmail(email);
  window.location.href = "./index.html";
});

// Abrir modal de código de acesso ao modo convidado
if (guestBtn) {
  guestBtn.addEventListener("click", () => {
    if (guestCodeModal) {
      guestCodeModal.classList.remove("hidden");
      // Limpar campos ao abrir
      if (guestCodeInput) guestCodeInput.value = "";
      if (guestCodeErrorMsg) {
        guestCodeErrorMsg.classList.add("hidden");
        guestCodeErrorMsg.textContent = "";
      }
      // Focar no input
      if (guestCodeInput) {
        setTimeout(() => guestCodeInput.focus(), 100);
      }
    }
  });
}

// Fechar modal de código de acesso
if (closeGuestCodeModalBtn) {
  closeGuestCodeModalBtn.addEventListener("click", () => {
    if (guestCodeModal) {
      guestCodeModal.classList.add("hidden");
    }
  });
}

// Fechar modal ao clicar fora
if (guestCodeModal) {
  guestCodeModal.addEventListener("click", (e) => {
    if (e.target === guestCodeModal) {
      guestCodeModal.classList.add("hidden");
    }
  });
}

// Submeter código de acesso ao modo convidado
if (guestCodeSubmitBtn && guestCodeInput) {
  // Permitir submissão com Enter
  guestCodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGuestCodeSubmit();
    }
  });

  guestCodeSubmitBtn.addEventListener("click", handleGuestCodeSubmit);
}

async function handleGuestCodeSubmit() {
  const code = guestCodeInput.value.trim();
  
  if (!code) {
    showGuestCodeError("Please enter the access code.");
    return;
  }
  
  try {
    // Validar código no backend via Vercel Serverless Function
    const response = await fetch("/api/validate-guest-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.valid) {
      showGuestCodeError(result.message || "Incorrect access code.");
      return;
    }
    
    // Código correto - ativar modo convidado
    enableGuestMode();
    
    // Fechar modal e redirecionar
    if (guestCodeModal) {
      guestCodeModal.classList.add("hidden");
    }
    
    window.location.href = "./index.html";
  } catch (err) {
    console.error("Erro ao validar código de acesso:", err);
    showGuestCodeError("Erro ao validar código. Tenta novamente.");
  }
}

function showGuestCodeError(msg) {
  if (guestCodeErrorMsg) {
    guestCodeErrorMsg.textContent = msg;
    guestCodeErrorMsg.classList.remove("hidden");
  } else {
    console.error("Erro no código de acesso:", msg);
    alert(msg);
  }
}

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      showError("Enter your email address first.");
      return;
    }
    
    const res = await sendPasswordReset(email);
    if (!res.ok) {
      showError(formatError(res.error));
      return;
    }
    
    showError("Password reset email sent! Check your inbox.", "success");
  });
}

// Abrir modal de criar conta
if (createAccountBtn) {
  createAccountBtn.addEventListener("click", () => {
    if (createAccountModal) {
      createAccountModal.classList.remove("hidden");
      // Limpar campos ao abrir
      if (createAccountForm) createAccountForm.reset();
      if (createAccountErrorMsg) {
        createAccountErrorMsg.classList.add("hidden");
        createAccountErrorMsg.textContent = "";
      }
    }
  });
}

// Fechar modal
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    if (createAccountModal) {
      createAccountModal.classList.add("hidden");
    }
  });
}

// Fechar modal ao clicar fora
if (createAccountModal) {
  createAccountModal.addEventListener("click", (e) => {
    if (e.target === createAccountModal) {
      createAccountModal.classList.add("hidden");
    }
  });
}

// Toggle password no modal de registro
const toggleRegisterPasswordBtn = document.getElementById("toggleRegisterPassword");
const registerPasswordInput = document.getElementById("registerPassword");
const eyeIconRegister = document.getElementById("eyeIconRegister");
const eyeOffIconRegister = document.getElementById("eyeOffIconRegister");

if (toggleRegisterPasswordBtn && registerPasswordInput) {
  toggleRegisterPasswordBtn.addEventListener("click", () => {
    const type = registerPasswordInput.getAttribute("type") === "password" ? "text" : "password";
    registerPasswordInput.setAttribute("type", type);
    
    if (type === "text") {
      if (eyeIconRegister) eyeIconRegister.classList.add("hidden");
      if (eyeOffIconRegister) eyeOffIconRegister.classList.remove("hidden");
    } else {
      if (eyeIconRegister) eyeIconRegister.classList.remove("hidden");
      if (eyeOffIconRegister) eyeOffIconRegister.classList.add("hidden");
    }
  });
}

// Submeter formulário de criar conta
if (createAccountForm) {
  createAccountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const secretCode = document.getElementById("secretCode").value.trim();
    
    // Validações
    if (!email || !password || !secretCode) {
      showCreateAccountError("Preenche todos os campos.");
      return;
    }
    
    try {
      // Validar código secreto no backend via Vercel Serverless Function
      const response = await fetch("/api/validate-secret-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: secretCode }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.valid) {
        showCreateAccountError(result.message || "Código secreto incorreto.");
        return;
      }
      
      // Criar conta
      const res = await register(email, password);
      
      if (!res.ok) {
        showCreateAccountError(formatRegisterError(res.error));
        return;
      }
      
      // Conta criada com sucesso - guardar email e redirecionar
      saveEmail(email);
      window.location.href = "./index.html";
    } catch (err) {
      console.error("Erro ao validar código secreto:", err);
      showCreateAccountError("Erro ao validar código. Tenta novamente.");
    }
  });
}

function showCreateAccountError(msg, type = "error") {
  if (createAccountErrorMsg) {
    createAccountErrorMsg.textContent = msg;
    createAccountErrorMsg.className = `text-sm text-center rounded-lg p-2 ${
      type === "success"
        ? "bg-green-900/20 border border-green-500/30 text-green-400"
        : "bg-red-900/20 border border-red-500/30 text-red-400"
    }`;
    createAccountErrorMsg.classList.remove("hidden");
  } else {
    console.error("Erro ao criar conta:", msg);
    alert(msg);
  }
}

function formatRegisterError(errCode) {
  switch (errCode) {
    case "auth/invalid-email": return "Email inválido.";
    case "auth/email-already-in-use": return "Este email já está em uso.";
    case "auth/weak-password": return "Password muito fraca. Use pelo menos 6 caracteres.";
    case "auth/operation-not-allowed": return "Operação não permitida.";
    default: return "Erro ao criar conta: " + errCode;
  }
}

function showError(msg, type = "error") {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.className = `text-sm text-center rounded-lg p-2 ${
      type === "success"
        ? "bg-green-900/20 border border-green-500/30 text-green-400"
        : "bg-red-900/20 border border-red-500/30 text-red-400"
    }`;
    errorMsg.classList.remove("hidden");
  } else {
    console.error("Erro de login:", msg);
    alert(msg);
  }
}

function formatError(errCode) {
  switch (errCode) {
    case "auth/invalid-email": return "Email inválido.";
    case "auth/user-not-found": return "Conta não encontrada.";
    case "auth/wrong-password": return "Password incorreta.";
    case "auth/invalid-credential": return "Email/Password incorreto/a.";
    case "auth/too-many-requests": return "Muitas tentativas. Tenta mais tarde.";
    case "auth/admin-restricted-operation": return "Login anónimo não está habilitado. Contacta o administrador.";
    default: return "Erro: " + errCode;
  }
}
