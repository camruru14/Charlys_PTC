// Destino de «volver a donde estabas» tras iniciar sesión. Solo se aceptan rutas internas del
// panel: empiezan con «/» y no con «//» ni «/\» (que el navegador toma como otro sitio), y no
// vuelven al propio login. Cualquier otra cosa cae en `fallback`.
export function safeRedirect(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return fallback;
  return value;
}

// «/ruta?x=1#h» de una ubicación de React Router (o de window.location).
export const pathOf = (location) => `${location.pathname}${location.search || ""}${location.hash || ""}`;
