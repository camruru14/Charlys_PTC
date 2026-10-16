// TEMPORAL — diagnóstico de la conexión con Wompi. SE BORRA después del diagnóstico
// (junto con la ruta /api/diag/wompi de app.js y scripts/diag-wompi.js).
//
// Nunca llama al cobro ni tokeniza una tarjeta: pide un token OAuth2 y manda a tokenización un
// body VACÍO (Wompi lo rechaza con un 4xx), solo para medir si api.wompi.sv responde y cuánto tarda.
// No devuelve secretos ni tokens: cada intento es { paso, status, ms, error }.
import { config } from "../../config.js";

const TIMEOUT_MS = 30000;

async function attempt(paso, url, options, timeoutMs = TIMEOUT_MS) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text().catch(() => "");
    return { paso, status: response.status, ms: Date.now() - startedAt, error: null, text };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    // error.cause trae el código de red (ECONNRESET, ETIMEDOUT, ENOTFOUND…) sin datos sensibles.
    const code = error?.cause?.code ? ` (${error.cause.code})` : "";
    return { paso, status: null, ms: Date.now() - startedAt, error: timedOut ? `sin respuesta tras ${timeoutMs / 1000} s` : `${error?.message ?? error}${code}` };
  }
}

const strip = ({ text, ...rest }) => rest;

export async function runWompiDiag() {
  const apiUrl = config.wompi.apiUrl;
  const results = [];

  // 1) Autenticación (se pide un token propio, sin tocar el cache del checkout).
  const auth = await attempt("autenticación (id.wompi.sv)", config.wompi.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: config.wompi.grantType,
      audience: config.wompi.audience,
      client_id: config.wompi.clientId,
      client_secret: config.wompi.clientSecret,
    }),
  });
  results.push(strip(auth));

  let token = null;
  if (auth.status >= 200 && auth.status < 300) {
    try {
      token = JSON.parse(auth.text).access_token ?? null;
    } catch {
      // respuesta ilegible: se sigue sin token
    }
  }

  // 2) api.wompi.sv SIN token: si responde 401 rápido, el host es alcanzable desde aquí.
  results.push(strip(await attempt("api.wompi.sv sin token (POST /tokenizacion, body vacío)", `${apiUrl}/tokenizacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })));

  // 3) Tokenización CON token y body vacío (Wompi lo rechaza; no tokeniza nada).
  if (token) {
    const withToken = { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}" };
    for (const path of ["tokenizacion", "Tokenizacion"]) {
      const r = await attempt(`tokenización con token, body vacío (POST /${path})`, `${apiUrl}/${path}`, withToken);
      // El 4xx de validación de un body vacío no tiene datos sensibles: se deja un extracto para ver qué dice Wompi.
      results.push({ ...strip(r), detalle: r.text ? r.text.slice(0, 300) : undefined });
    }
  } else {
    results.push({ paso: "tokenización con token", status: null, ms: 0, error: "omitido: no hubo token de autenticación" });
  }

  // 4) IP pública de salida, por si Wompi debe autorizarla.
  const ip = await attempt("IP pública de salida (api.ipify.org)", "https://api.ipify.org?format=json", {}, 10000);
  let ipPublica = null;
  try {
    ipPublica = JSON.parse(ip.text).ip ?? null;
  } catch {
    // sin IP
  }
  results.push(strip(ip));

  return { node: process.version, apiUrl, ipPublica, intentos: results };
}
