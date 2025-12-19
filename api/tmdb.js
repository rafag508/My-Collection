// api/tmdb.js
// ✅ Vercel Serverless Function - TMDB API Proxy
// Protege a API key do TMDB mantendo-a no servidor

// 🔑 SECRET KEY (lida de variáveis de ambiente do Vercel)
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responder a preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Apenas permitir POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
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

    // Adicionar parâmetros do cliente (suporta chaves com pontos como "vote_count.gte")
    // O idioma virá do cliente através do parâmetro 'language'
    if (params && typeof params === "object") {
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    // Se o cliente não enviou parâmetro de idioma, usar inglês como padrão
    if (!params || !params.language) {
      queryParams.append("language", "en-US");
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
        message: errorText,
      });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("TMDB Proxy Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}

