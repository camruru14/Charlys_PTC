// Cliente HTTP hacia Web/public/backend (tienda pública). Mismo patrón que
// src/lib/api.js, apuntando al backend de la tienda — lo usará la pantalla
// de Catálogo en una fase posterior para administrar productos con el mismo
// token de empleado (ver Web/public/backend/src/middlewares/
// employeeAuthMiddleware.js).
//
// 10.0.2.2 es el alias del emulador de Android Studio hacia el "localhost"
// de la máquina host — cambiala por la IP de LAN de tu máquina si probás en
// un dispositivo físico con Expo Go.
import { emitUnauthorized } from "./sessionEvents";

export const PUBLIC_API_URL = "http://10.0.2.2:4100/api";

let getToken = () => null;

export function setPublicTokenGetter(fn) {
  getToken = fn;
}

// `isForm: true` (usado por Catálogo para subir imágenes, Fase 3): manda
// `body` tal cual como multipart/form-data en vez de hacerle
// JSON.stringify, y omite el header Content-Type para que fetch le agregue
// el boundary correcto solo — mismo criterio que la variante `isForm` de
// Web/private/frontend/src/lib/publicApi.js.
async function request(path, { method = "GET", body, isForm = false } = {}) {
  const token = await getToken();

  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  // Misma sesión de empleado que private/backend (mismo JWT_Secret_key):
  // avisa por sessionEvents igual que src/lib/api.js, así un 401/403 acá
  // (ej. token vencido mientras se administra Catálogo) también dispara el
  // logout automático de AuthContext.
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

export const publicApi = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default publicApi;
