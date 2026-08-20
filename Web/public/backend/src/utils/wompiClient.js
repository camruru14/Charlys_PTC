import fetch from "node-fetch";
import { config } from "../../config.js";

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

  const response = await fetch(config.wompi.authUrl, {
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
    throw new Error(`Wompi auth falló (${response.status}): ${text}`);
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

  const response = await fetch(`${config.wompi.apiUrl}/tokenizacion`, {
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
    const text = await response.text().catch(() => "");
    throw new Error(`Wompi tokenización falló (${response.status}): ${text}`);
  }

  return response.json(); // { token, tarjetaEnmascarada, ... }
}

// --- Cobrar una tarjeta ya tokenizada (sin 3D Secure) -----------------------
// https://docs.wompi.sv/metodos-api/transaccion-de-compra
async function chargeTokenizedCard({ tokenTarjeta, monto, nombreCliente, emailCliente }) {
  const token = await getAccessToken();

  const response = await fetch(`${config.wompi.apiUrl}/TransaccionCompra/TokenizadaSin3Ds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ monto, nombreCliente, emailCliente, tokenTarjeta }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Wompi cobro falló (${response.status}): ${text}`);
  }

  return response.json(); // { esAprobada, idTransaccion, formaPago, codigoAutorizacion, mensaje, ... }
}

export const wompiClient = {
  getAccessToken,
  tokenizeCard,
  chargeTokenizedCard,
};

export default wompiClient;
