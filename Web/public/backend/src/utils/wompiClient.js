import fetch from "node-fetch";
import { config } from "../../config.js";

// Tiempo máximo de espera de cada llamada a Wompi: sin esto, un Wompi colgado deja
// la petición del cliente (y su conexión) abierta indefinidamente.
const WOMPI_TIMEOUT_MS = 20000;

// Error con el status y el mensaje que ve el cliente (el checkout lo responde tal cual).
//   402: Wompi rechazó los datos de la tarjeta o el cobro (el cliente corrige o prueba otra);
//   502/504: Wompi falló o no respondió (el cliente puede reintentar; `unconfirmed`
//            marca el cobro cuyo resultado se desconoce).
function paymentError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...extra });
}

// fetch con tiempo límite. Un timeout o un corte de red no es una respuesta de Wompi:
// se convierte en un error legible (y se deja en el log).
async function wompiFetch(step, url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(WOMPI_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error(`Wompi ${step}: ${timedOut ? `sin respuesta tras ${WOMPI_TIMEOUT_MS / 1000} s` : error}`);
    throw paymentError(
      timedOut ? 504 : 502,
      timedOut
        ? "El procesador de pagos tardó demasiado en responder. Intenta de nuevo en unos minutos."
        : "No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo en unos minutos.",
      { unconfirmed: step === "cobro" },
    );
  }
}

// Respuesta no exitosa de Wompi: los 4xx de datos (tarjeta inválida, rechazada,
// vencida…) son un 402 con un mensaje para el cliente, no un 500; el detalle crudo
// solo va al log. Un 401/403/429 o un 5xx son un problema nuestro o de Wompi (502).
async function failure(step, response, clientMessage) {
  const text = await response.text().catch(() => "");
  console.error(`Wompi ${step} falló (${response.status}): ${text}`);
  const isCardProblem = response.status >= 400 && response.status < 500 && ![401, 403, 429].includes(response.status);
  if (isCardProblem) return paymentError(402, clientMessage);
  return paymentError(502, "El procesador de pagos no está disponible en este momento. Intenta de nuevo en unos minutos.", { unconfirmed: step === "cobro" });
}

// --- Autenticación OAuth2 (Client Credentials) -----------------------------
// Wompi El Salvador emite un access_token vía OAuth2 en id.wompi.sv. Lo
// cacheamos en memoria hasta poco antes de que expire para no pedir un token
// nuevo en cada request (ver https://docs.wompi.sv/auntenticacion/autenticacion).
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const response = await wompiFetch("autenticación", config.wompi.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: config.wompi.grantType,
      audience: config.wompi.audience,
      client_id: config.wompi.clientId,
      client_secret: config.wompi.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`Wompi auth falló (${response.status}): ${text}`);
    throw paymentError(502, "El procesador de pagos no está disponible en este momento. Intenta de nuevo en unos minutos.");
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Restamos 60s de margen de seguridad antes de la expiración real.
  cachedTokenExpiresAt = now + (data.expires_in - 60) * 1000;

  return cachedToken;
}

// --- Tokenizar tarjeta -------------------------------------------------------
// Cambia el número de tarjeta por un token de un solo uso: la tarjeta real
// nunca se guarda ni se reenvía después de este paso.
// https://docs.wompi.sv/metodos-api/tokenizacion
async function tokenizeCard({ numeroTarjeta, cvv, mesVencimiento, anioVencimiento, nombreTarjetaHabiente }) {
  const token = await getAccessToken();

  const response = await wompiFetch("tokenización", `${config.wompi.apiUrl}/tokenizacion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      numeroTarjeta,
      cvv,
      mesVencimiento: parseInt(mesVencimiento, 10),
      anioVencimiento: parseInt(anioVencimiento, 10),
      nombreTarjetaHabiente,
    }),
  });

  if (!response.ok) {
    throw await failure("tokenización", response, "Revisa los datos de tu tarjeta (número, fecha de vencimiento y código de seguridad) e intenta de nuevo.");
  }

  return response.json(); // { token, tarjetaEnmascarada, ... }
}

// --- Cobrar una tarjeta ya tokenizada (sin 3D Secure) -----------------------
// https://docs.wompi.sv/metodos-api/transaccion-de-compra
async function chargeTokenizedCard({ tokenTarjeta, monto, nombreCliente, emailCliente }) {
  const token = await getAccessToken();

  const response = await wompiFetch("cobro", `${config.wompi.apiUrl}/TransaccionCompra/TokenizadaSin3Ds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ monto, nombreCliente, emailCliente, tokenTarjeta }),
  });

  if (!response.ok) {
    throw await failure("cobro", response, "Tu tarjeta fue rechazada. Intenta con otra.");
  }

  // 2xx: Wompi pudo haber cobrado. Si el cuerpo no se puede leer no sabemos el resultado, así que
  // es un cobro sin confirmar (se guarda para conciliar y el cliente no reintenta), no un 500.
  try {
    return await response.json(); // { esAprobada, idTransaccion, formaPago, codigoAutorizacion, mensaje, ... }
  } catch (error) {
    console.error(`Wompi cobro: respuesta ${response.status} ilegible: ${error}`);
    throw paymentError(502, "No pudimos confirmar el resultado de tu pago.", { unconfirmed: true });
  }
}

export const wompiClient = {
  getAccessToken,
  tokenizeCard,
  chargeTokenizedCard,
};

export default wompiClient;
