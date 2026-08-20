/*
  Cliente HTTP hacia public/backend (la tienda pública), separado de
  src/lib/api.js (que apunta a private/backend). Se usa solo desde
  pages/Catalogo.jsx para administrar el catálogo de productos.

  public/backend valida la sesión de empleado con el mismo JWT que ya generó
  private/backend al iniciar sesión en este panel (ver
  public/backend/src/middlewares/employeeAuthMiddleware.js), pero acá se
  manda como header "Authorization: Bearer <token>" en vez de depender de la
  cookie httpOnly de private/backend: al ser dos servicios en dominios
  distintos (dos servicios separados en Render), el navegador nunca comparte
  cookies entre ellos, aunque ambos backends compartan el mismo
  JWT_Secret_key. El token se registra acá vía setPublicApiToken(), llamado
  desde AuthContext.jsx apenas hay sesión (login o restaurada desde
  localStorage).
*/
export const PUBLIC_API_URL = import.meta.env.VITE_PUBLIC_API_URL || "http://localhost:4100/api";

const SESSION_STORAGE_KEY = "charly:auth-session";

// Token de la sesión de empleado, inyectado por AuthContext.jsx. En memoria
// (no en un closure de React) para que este módulo lo pueda leer sin pasar
// por contexto — mismo patrón que setTokenGetter en Movil/src/lib/api.js.
let authToken = null;

export function setPublicApiToken(token) {
  authToken = token || null;
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method,
    headers,
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
