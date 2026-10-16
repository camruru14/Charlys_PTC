import fetch from "node-fetch";
import { config } from "../../config.js";

// Tiempo máximo de espera de cada llamada a Wompi: sin esto, un Wompi colgado deja
// la petición del cliente (y su conexión) abierta indefinidamente. Wompi a veces tarda
// más de 20 s, así que cada paso tiene su margen.
const WOMPI_AUTH_TIMEOUT_MS = 30000; // autenticación (OAuth2)
const WOMPI_TOKENIZE_TIMEOUT_MS = 30000; // tokenización de la tarjeta
const WOMPI_CHARGE_TIMEOUT_MS = 60000; // cobro: el que más puede tardar y el que no se reintenta

// Espera antes del único reintento de la autenticación y la tokenización.
const WOMPI_RETRY_DELAY_MS = 1000;

// Error con el status y el mensaje que ve el cliente (el checkout lo responde tal cual).
//   402: Wompi rechazó los datos de la tarjeta o el cobro (el cliente corrige o prueba otra);
//   502/504: Wompi falló o no respondió (el cliente puede reintentar; `unconfirmed`
//            marca el cobro cuyo resultado se desconoce).
// `step` dice en qué paso ocurrió (autenticación, tokenización o cobro): el modo `auto` de
// utils/payments.js lo usa para saber si pudo fallar ANTES de cobrar.
function paymentError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...extra });
}

// fetch con tiempo límite. Un timeout o un corte de red no es una respuesta de Wompi:
// se convierte en un error legible (y se deja en el log).
// En el log queda el paso, el status y los ms de cada llamada; nunca el cuerpo enviado
// (tarjeta, CVV, credenciales) ni el token.
async function wompiFetch(step, url, options, timeoutMs) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    console.log(`Wompi ${step}: ${response.status} en ${Date.now() - startedAt} ms`);
    return response;
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const elapsed = Date.now() - startedAt;
    console.error(`Wompi ${step}: ${timedOut ? `sin respuesta tras ${timeoutMs / 1000} s` : error?.message ?? error} (${elapsed} ms)`);
    throw paymentError(
      timedOut ? 504 : 502,
      timedOut
        ? "El procesador de pagos tardó demasiado en responder. Intenta de nuevo en unos minutos."
        : "No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo en unos minutos.",
      { step, unconfirmed: step === "cobro" },
    );
  }
}

// wompiFetch con un único reintento (tras 1 s) si falla por timeout, error de red o un 5xx
// de Wompi. Solo para pasos que NO mueven dinero (autenticación y tokenización): el cobro
// nunca pasa por aquí, porque reintentarlo podría cobrar dos veces.
async function wompiFetchWithRetry(step, url, options, timeoutMs) {
  const wait = () => new Promise((resolve) => setTimeout(resolve, WOMPI_RETRY_DELAY_MS));

  let response;
  try {
    response = await wompiFetch(step, url, options, timeoutMs);
  } catch {
    console.warn(`Wompi ${step}: reintentando en ${WOMPI_RETRY_DELAY_MS / 1000} s`);
    await wait();
    return wompiFetch(step, url, options, timeoutMs);
  }

  if (response.status < 500) return response;

  await response.arrayBuffer().catch(() => {}); // se libera la conexión antes de reintentar
  console.warn(`Wompi ${step}: reintentando en ${WOMPI_RETRY_DELAY_MS / 1000} s`);
  await wait();
  return wompiFetch(step, url, options, timeoutMs);
}

// Respuesta no exitosa de Wompi: los 4xx de datos (tarjeta inválida, rechazada,
// vencida…) son un 402 con un mensaje para el cliente, no un 500; el detalle crudo
// solo va al log. Un 401/403/429 o un 5xx son un problema nuestro o de Wompi (502).
async function failure(step, response, clientMessage) {
  const text = await response.text().catch(() => "");
  console.error(`Wompi ${step} falló (${response.status}): ${text}`);
  const isCardProblem = response.status >= 400 && response.status < 500 && ![401, 403, 429].includes(response.status);
  if (isCardProblem) return paymentError(402, clientMessage, { step });
  return paymentError(502, "El procesador de pagos no está disponible en este momento. Intenta de nuevo en unos minutos.", { step, unconfirmed: step === "cobro" });
}

// --- Autenticación OAuth2 (Client Credentials) -----------------------------
// Wompi El Salvador emite un access_token vía OAuth2 en id.wompi.sv. Lo
// cacheamos en memoria hasta poco antes de que expire para no pedir un token
// nuevo en cada request (ver https://docs.wompi.sv/auntenticacion/autenticacion).
let cachedToken = null;
let cachedTokenExpiresAt = 0;
// Petición de token en curso: el precalentado del arranque y un primer cliente que llegue
// mientras tanto comparten la misma llamada en vez de pedir dos tokens.
let pendingToken = null;

// `budgetMs` (modo `auto`): tiempo máximo que esta llamada espera el token, sin reintentos; pasado
// ese tiempo falla con un 504 aunque la petición de fondo siga en curso (y, si llega, deje el token en caché).
async function getAccessToken({ budgetMs } = {}) {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }
  pendingToken ??= (budgetMs ? requestAccessToken({ timeoutMs: budgetMs, retry: false }) : requestAccessToken()).finally(() => {
    pendingToken = null;
  });
  return budgetMs ? withinBudget("autenticación", pendingToken, budgetMs) : pendingToken;
}

// Espera `promise` como máximo `ms`; si no llega, 504 del `step` (la promesa original sigue su curso).
function withinBudget(step, promise, ms) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(paymentError(504, "El procesador de pagos tardó demasiado en responder.", { step })), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

// Al arrancar el servidor: pide el token en segundo plano para que el primer cliente no
// espere esa llamada. No bloquea el arranque y solo deja rastro si falla (el checkout
// volverá a pedirlo por su cuenta).
function warmUpAccessToken() {
  getAccessToken().catch((error) => {
    console.error(`Wompi: no se pudo precalentar el token: ${error.message}`);
  });
}

async function requestAccessToken({ timeoutMs = WOMPI_AUTH_TIMEOUT_MS, retry = true } = {}) {
  const startedAt = Date.now();
  const response = await (retry ? wompiFetchWithRetry : wompiFetch)(
    "autenticación",
    config.wompi.authUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: config.wompi.grantType,
        audience: config.wompi.audience,
        client_id: config.wompi.clientId,
        client_secret: config.wompi.clientSecret,
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`Wompi auth falló (${response.status}): ${text}`);
    throw paymentError(502, "El procesador de pagos no está disponible en este momento. Intenta de nuevo en unos minutos.", { step: "autenticación" });
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Restamos 60s de margen de seguridad antes de la expiración real.
  cachedTokenExpiresAt = startedAt + (data.expires_in - 60) * 1000;

  return cachedToken;
}

// --- Tokenizar tarjeta -------------------------------------------------------
// Cambia el número de tarjeta por un token de un solo uso: la tarjeta real
// nunca se guarda ni se reenvía después de este paso.
// https://docs.wompi.sv/metodos-api/tokenizacion
// `budgetMs` (modo `auto`): presupuesto TOTAL para autenticación + tokenización, sin reintentos.
async function tokenizeCard({ numeroTarjeta, cvv, mesVencimiento, anioVencimiento, nombreTarjetaHabiente }, { budgetMs } = {}) {
  const startedAt = Date.now();
  const token = await getAccessToken({ budgetMs });
  const remainingMs = budgetMs ? budgetMs - (Date.now() - startedAt) : WOMPI_TOKENIZE_TIMEOUT_MS;
  if (remainingMs <= 0) throw paymentError(504, "El procesador de pagos tardó demasiado en responder.", { step: "tokenización" });

  // Tokenizar no mueve dinero: se puede reintentar una vez si Wompi no responde (salvo con presupuesto).
  const response = await (budgetMs ? wompiFetch : wompiFetchWithRetry)(
    "tokenización",
    `${config.wompi.apiUrl}/tokenizacion`,
    {
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
    },
    remainingMs,
  );

  if (!response.ok) {
    throw await failure("tokenización", response, "Revisa los datos de tu tarjeta (número, fecha de vencimiento y código de seguridad) e intenta de nuevo.");
  }

  return response.json(); // { token, tarjetaEnmascarada, ... }
}

// --- Cobrar una tarjeta ya tokenizada (sin 3D Secure) -----------------------
// https://docs.wompi.sv/metodos-api/transaccion-de-compra
// `timeoutMs`: el modo `auto` usa uno más corto que el normal.
async function chargeTokenizedCard({ tokenTarjeta, monto, nombreCliente, emailCliente }, { timeoutMs = WOMPI_CHARGE_TIMEOUT_MS } = {}) {
  const token = await getAccessToken();

  // El cobro NUNCA se reintenta (wompiFetch directo): un reintento podría cobrar dos veces.
  const response = await wompiFetch(
    "cobro",
    `${config.wompi.apiUrl}/TransaccionCompra/TokenizadaSin3Ds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monto, nombreCliente, emailCliente, tokenTarjeta }),
    },
    timeoutMs,
  );

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
  warmUpAccessToken,
  tokenizeCard,
  chargeTokenizedCard,
};

export default wompiClient;
