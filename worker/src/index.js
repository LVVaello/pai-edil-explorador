/**
 * Proxy seguro entre el explorador PAI EDIL y la API de Claude.
 *
 * Qué hace:
 *  - Exige una cabecera X-Access-Key que debe coincidir con el secreto
 *    ACCESS_KEY configurado en Cloudflare (así solo tu equipo puede usar el chat).
 *  - Soporta { action: "ping" } para que la página compruebe la clave sin
 *    gastar ninguna llamada a la API de Claude.
 *  - Con una pregunta real, llama a la API de Anthropic usando
 *    ANTHROPIC_API_KEY (secreto aparte) y devuelve solo el texto de la respuesta.
 *
 * Ambas claves (ACCESS_KEY y ANTHROPIC_API_KEY) se configuran como "secret"
 * en Cloudflare (ver README.md). Nunca están en este archivo ni en el
 * repositorio, así que es seguro que este código sea público.
 */

const MODEL = "claude-haiku-4-5-20251001"; // económico; cámbialo si prefieres otro modelo
const MAX_TOKENS = 1024;

// Límites básicos de abuso (ajustables)
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SYSTEM_CHARS = 60000;

function corsHeaders(origin, allowedOrigin) {
  const allow = allowedOrigin === "*" ? "*" : (origin === allowedOrigin ? origin : allowedOrigin);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Key",
    "Access-Control-Max-Age": "86400",
  };
}

// Comparación en tiempo constante para no filtrar la clave por temporización.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido" }, 405, cors);
    }

    if (!env.ACCESS_KEY) {
      return json({ error: "El servidor no tiene configurada ACCESS_KEY" }, 500, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "El servidor no tiene configurada ANTHROPIC_API_KEY" }, 500, cors);
    }

    const providedKey = request.headers.get("X-Access-Key") || "";
    if (!safeEqual(providedKey, env.ACCESS_KEY)) {
      return json({ error: "Clave de acceso incorrecta" }, 401, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400, cors);
    }

    // Comprobación de clave sin gastar llamada a la API de Claude.
    if (body.action === "ping") {
      return json({ ok: true }, 200, cors);
    }

    const system = String(body.system || "").slice(0, MAX_SYSTEM_CHARS);
    let messages = Array.isArray(body.messages) ? body.messages : [];
    messages = messages.slice(-MAX_MESSAGES).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, MAX_MESSAGE_CHARS),
    }));

    if (messages.length === 0) {
      return json({ error: "No se ha recibido ninguna pregunta" }, 400, cors);
    }

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
        }),
      });

      const data = await anthropicRes.json();

      if (!anthropicRes.ok) {
        const msg = (data && data.error && data.error.message) || "Error llamando a la API de Claude";
        return json({ error: msg }, anthropicRes.status, cors);
      }

      const textBlock = (data.content || []).find(b => b.type === "text");
      const reply = textBlock ? textBlock.text : "";

      return json({ reply }, 200, cors);
    } catch (err) {
      return json({ error: "Fallo de red hacia la API de Claude: " + err.message }, 502, cors);
    }
  },
};
