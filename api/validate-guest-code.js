// api/validate-guest-code.js
// ✅ Vercel Serverless Function - Validar código de acesso ao modo convidado
// Protege o código de acesso mantendo-o no servidor

// 🔑 SECRET CODE (nunca exposto no cliente)
const GUEST_ACCESS_CODE = "DemoVault_73Z!PR";

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
    const isValid = code === GUEST_ACCESS_CODE;

    res.status(200).json({
      valid: isValid,
      message: isValid ? "Valid code" : "Invalid access code",
    });
  } catch (error) {
    console.error("Validate Guest Code Error:", error);
    res.status(500).json({
      valid: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}

