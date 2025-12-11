// functions/index.js
// Firebase Cloud Functions para proteger API keys e códigos secretos

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializar Firebase Admin (apenas se ainda não estiver inicializado)
if (!admin.apps.length) {
  admin.initializeApp();
}

// =====================================================
// 🔑 SECRET KEYS (NUNCA expostos no cliente)
// =====================================================
const TMDB_API_KEY = "247df79ee01d4f732791bf8c8c448f5e";
const GUEST_ACCESS_CODE = "DemoVault_73Z!PR";
const SECRET_CODE = "TheCollection_25!";

// =====================================================
// 🎬 TMDB API PROXY
// =====================================================
// Faz proxy de todas as chamadas TMDB, mantendo a API key segura no servidor
exports.tmdbProxy = functions.https.onRequest(async (req, res) => {
  // Permitir CORS (Cross-Origin Resource Sharing)
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Responder a preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    // Extrair parâmetros do request
    const { endpoint, params } = req.body;
    
    if (!endpoint) {
      res.status(400).json({ error: "Missing 'endpoint' parameter" });
      return;
    }

    // Construir URL do TMDB
    const baseUrl = "https://api.themoviedb.org/3";
    const queryParams = new URLSearchParams();
    
    // Adicionar parâmetros fixos
    queryParams.append("api_key", TMDB_API_KEY);
    queryParams.append("language", "en-US");
    
    // Adicionar parâmetros do cliente (suporta chaves com pontos como "vote_count.gte")
    if (params && typeof params === "object") {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    const tmdbUrl = `${baseUrl}/${endpoint}?${queryParams.toString()}`;

    // Fazer requisição ao TMDB
    const response = await fetch(tmdbUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("TMDB API Error:", response.status, errorText);
      res.status(response.status).json({ 
        error: "TMDB API error",
        status: response.status,
        message: errorText
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("TMDB Proxy Error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
});

// =====================================================
// 🔐 VALIDATE GUEST ACCESS CODE
// =====================================================
// Valida o código de acesso ao modo convidado
exports.validateGuestCode = functions.https.onCall(async (data, context) => {
  const { code } = data;
  
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Invalid code format" };
  }

  // Validar código (case-sensitive)
  const isValid = code === GUEST_ACCESS_CODE;
  
  return { 
    valid: isValid,
    message: isValid ? "Valid code" : "Invalid access code"
  };
});

// =====================================================
// 🔐 VALIDATE SECRET CODE (for account creation)
// =====================================================
// Valida o código secreto necessário para criar conta
exports.validateSecretCode = functions.https.onCall(async (data, context) => {
  const { code } = data;
  
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Invalid code format" };
  }

  // Validar código (case-sensitive)
  const isValid = code === SECRET_CODE;
  
  return { 
    valid: isValid,
    message: isValid ? "Valid code" : "Invalid secret code"
  };
});

