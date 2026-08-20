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

export function setAuthToken(token) {
  authToken = token || null;
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  // Sesión inválida/expirada -> forzar re-login
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Error ${response.status}`);
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
