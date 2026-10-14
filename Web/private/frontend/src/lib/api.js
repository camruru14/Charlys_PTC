import { pathOf, safeRedirect } from "./redirect";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const SESSION_STORAGE_KEY = "charly:auth-session";

// Token de la sesión, en memoria (además de la cookie httpOnly). Hace falta
// porque Safari (iOS y macOS) bloquea por defecto las cookies "de terceros"
// (Intelligent Tracking Prevention) cuando el frontend y el backend están en
// dominios distintos (Vercel vs Render): la cookie de sesión nunca llega a
// guardarse ahí, así que sin este token de respaldo el login no persiste en
// iPhone/Safari, aunque funcione bien en Chrome/Edge. authMiddleware.js del
// backend ya acepta este header como alternativa a la cookie -- es el mismo
// mecanismo que ya usa la app móvil. Se registra vía setAuthToken(), llamado
// desde AuthContext.jsx apenas hay sesión (login o restaurada desde
// localStorage).
let authToken = null;

// Aviso de que un POST/PUT/PATCH/DELETE terminó bien: las burbujas de novedades
// (context/ActivityContext.jsx) vuelven a pedir sus conteos. Las propias
// llamadas a /activity no lo emiten (no se pide a sí mismas).
export const MUTATION_EVENT = "charly:api-mutation";

export function setAuthToken(token) {
  authToken = token || null;
}

async function request(path, { method = "GET", body } = {}) {
  // FormData (subida de archivos): el navegador pone el Content-Type con su boundary.
  const isForm = body instanceof FormData;
  const headers = {};
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  // Sesión inválida/expirada -> forzar re-login. Un 403 con `code` (ADMIN_ONLY,
  // ACCOUNT_FORBIDDEN, MODULE_FORBIDDEN: falta de permiso para esa acción) no es
  // una sesión inválida: se muestra su mensaje y la sesión sigue abierta.
  if (response.status === 401 || (response.status === 403 && !payload?.code)) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (!window.location.pathname.startsWith("/login")) {
      // Se guarda a dónde volver (ruta completa, con ?tab=… y demás) para que el login regrese ahí.
      const back = safeRedirect(pathOf(window.location));
      window.location.assign(back === "/" ? "/login" : `/login?from=${encodeURIComponent(back)}`);
    }
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  if (!response.ok) {
    // El status viaja en el error: los formularios distinguen un 409 (conflicto) de otros fallos.
    const error = new Error(payload?.message || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (method !== "GET" && !path.startsWith("/activity")) window.dispatchEvent(new Event(MUTATION_EVENT));

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
