/*
  Cliente HTTP hacia public/backend (la tienda pública), separado de
  src/lib/api.js (que apunta a private/backend). Se usa solo desde
  pages/Catalogo.jsx para administrar el catálogo de productos.

  No hace falta loguearse aparte: public/backend valida la MISMA cookie de
  sesión de empleado ("authCookie") que ya puso private/backend al iniciar
  sesión en este panel (ver
  public/backend/src/middlewares/employeeAuthMiddleware.js), así que
  `credentials: "include"` es suficiente.
*/
export const PUBLIC_API_URL = import.meta.env.VITE_PUBLIC_API_URL || "http://localhost:4100/api";

const SESSION_STORAGE_KEY = "charly:auth-session";

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  // Sesión inválida/expirada -> forzar re-login (mismo criterio que lib/api.js)
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

export const publicApi = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default publicApi;
