export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const SESSION_STORAGE_KEY = "charly:auth-session";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
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
