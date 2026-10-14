export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4100/api";

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  if (!response.ok) {
    // El status y el cuerpo viajan en el error: el checkout necesita el 409 con los
    // precios nuevos (payload.products) y distingue el 402 de la tarjeta.
    const error = new Error(payload?.message || `Error ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export default api;
