// Cliente HTTP hacia Web/private/backend (panel administrativo).
// Mismo patrón que Web/private/frontend/src/lib/api.js (función `request` +
// objeto `api` con get/post/put/patch/del), pero la app móvil no puede usar
// la cookie httpOnly del panel web, así que manda el JWT como header
// "Authorization: Bearer <token>" en cada request.
//
// La URL del backend se resuelve en este orden (ver resolveApiUrl):
//   a) EXPO_PUBLIC_API_URL en Movil/.env, tal cual (debe terminar en /api).
//      Para un backend desplegado o un túnel. Se lee al iniciar Expo, así
//      que después de cambiarla hay que reiniciar con `npx expo start -c`.
//   b) Si no está definida, se usa la IP del servidor de desarrollo de Expo
//      (Constants.expoConfig.hostUri, sin el puerto de Metro) con el puerto
//      4000: con Expo Go en un celular en la misma red Wi-Fi, esa IP es la de
//      la computadora donde corre Web/private/backend.
//   c) Sin hostUri (build sin Metro) o si Expo corre por túnel: 10.0.2.2 en
//      Android (alias del "localhost" de la máquina, SOLO existe dentro del
//      emulador) y localhost en iOS (simulador).
import { Platform } from "react-native";
import Constants from "expo-constants";
import { emitUnauthorized } from "./sessionEvents";

const BACKEND_PORT = 4000;

function isIpOrLocalhost(host) {
  return host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function resolveApiUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  const fallback =
    Platform.OS === "android"
      ? `http://10.0.2.2:${BACKEND_PORT}/api`
      : `http://localhost:${BACKEND_PORT}/api`;

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    return fallback;
  }

  const host = hostUri.split(":")[0];
  if (!isIpOrLocalhost(host)) {
    // Túnel (exp.direct, ngrok, etc.): ese dominio apunta a Metro, no al
    // backend, así que no sirve para armar la URL de la API.
    console.warn(
      `Expo está corriendo por túnel (${host}), así que la app no puede ` +
        "adivinar la dirección del backend. Define EXPO_PUBLIC_API_URL en " +
        "Movil/.env con la URL pública del backend (terminada en /api) y " +
        `reinicia con "npx expo start -c". Mientras tanto se usa ${fallback}.`
    );
    return fallback;
  }

  return `http://${host}:${BACKEND_PORT}/api`;
}

export const API_URL = resolveApiUrl();

// Función inyectada por AuthContext para leer el token actual sin acoplar
// este módulo a React ni a expo-secure-store directamente.
let getToken = () => null;

export function setTokenGetter(fn) {
  getToken = fn;
}

// FormData (Catálogo, subir imágenes): se manda tal cual como
// multipart/form-data, sin header Content-Type, para que fetch le agregue el
// boundary correcto solo.
async function request(path, { method = "GET", body } = {}) {
  const token = await getToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  // fetch solo lanza cuando no hubo respuesta (servidor apagado, sin red,
  // IP equivocada); los 401 y 5xx llegan como response y se manejan abajo.
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    const error = new Error(
      "No se pudo conectar con el servidor. Revisa que el backend esté encendido y que el celular esté en la misma red."
    );
    error.isNetworkError = true;
    throw error;
  }

  // Sesión inválida/expirada: a diferencia de la web (que redirige con
  // window.location.assign("/login")), acá se avisa por sessionEvents —
  // AuthContext está suscrito y borra el token guardado, lo que hace que
  // RootNavigator pase solo a LoginScreen (mismo criterio reactivo que ya
  // usa para decidir qué mostrar). Se sigue lanzando el error, con
  // error.status marcado, para que el caller pueda distinguirlo de otros
  // errores si igual quiere mostrar algo antes de que la pantalla cambie.
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  // El 403 de «solo administradores» (code ADMIN_ONLY) no es una sesión
  // inválida: se muestra su mensaje y la sesión sigue abierta.
  if (response.status === 401 || (response.status === 403 && payload?.code !== "ADMIN_ONLY")) {
    const error = new Error("Sesión expirada. Inicia sesión nuevamente.");
    error.status = response.status;
    emitUnauthorized();
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;
