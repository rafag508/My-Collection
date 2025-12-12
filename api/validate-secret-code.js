// api/validate-secret-code.js
// ✅ Vercel Serverless Function - Validar código secreto para criação de conta
// Protege o código secreto mantendo-o no servidor

// 🔑 SECRET CODE (lido de variáveis de ambiente do Vercel)
const SECRET_CODE = process.env.SECRET_CODE;

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      res.status(400).json({
        valid: false,
        error: "Invalid code format",
      });
      return;
    }

    // Validar código (case-sensitive)
    const isValid = code === SECRET_CODE;

    res.status(200).json({
      valid: isValid,
      message: isValid ? "Valid code" : "Invalid secret code",
    });
  } catch (error) {
    console.error("Validate Secret Code Error:", error);
    res.status(500).json({
      valid: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}

