// Cliente HTTP hacia Web/private/backend (panel administrativo).
// Mismo patrón que Web/private/frontend/src/lib/api.js (función `request` +
// objeto `api` con get/post/put/patch/del), pero la app móvil no puede usar
// la cookie httpOnly del panel web, así que manda el JWT como header
// "Authorization: Bearer <token>" en cada request.
//
// 10.0.2.2 es un alias especial que el emulador de Android Studio resuelve
// hacia el "localhost" de la máquina que lo hospeda — SOLO existe dentro del
// emulador. Si probás la app en un dispositivo físico con Expo Go, cambiá
// esta URL por la IP de LAN de tu máquina (ej. "http://192.168.1.20:4000/api"),
// porque el celular no tiene forma de resolver 10.0.2.2.
import { emitUnauthorized } from "./sessionEvents";

export const API_URL = "http://192.168.1.18:4000/api";

// Función inyectada por AuthContext para leer el token actual sin acoplar
// este módulo a React ni a expo-secure-store directamente.
let getToken = () => null;

export function setTokenGetter(fn) {
  getToken = fn;
}

async function request(path, { method = "GET", body } = {}) {
  const token = await getToken();

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Sesión inválida/expirada: a diferencia de la web (que redirige con
  // window.location.assign("/login")), acá se avisa por sessionEvents —
  // AuthContext está suscrito y borra el token guardado, lo que hace que
  // RootNavigator pase solo a LoginScreen (mismo criterio reactivo que ya
  // usa para decidir qué mostrar). Se sigue lanzando el error, con
  // error.status marcado, para que el caller pueda distinguirlo de otros
  // errores si igual quiere mostrar algo antes de que la pantalla cambie.
  if (response.status === 401 || response.status === 403) {
    const error = new Error("Sesión expirada. Inicia sesión nuevamente.");
    error.status = response.status;
    emitUnauthorized();
    throw error;
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

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
