// Destino de «volver a donde estabas» tras iniciar sesión. Solo se aceptan rutas internas del
// panel: empiezan con «/», no contienen «\» ni caracteres de control (que el navegador normaliza a
// «//» o a otro sitio: «/\evil.com», «/\t/evil.com»), no son «//» y, resueltas contra un origen
// cualquiera, se quedan en ese origen. Tampoco vuelven al propio login. Todo lo demás cae en `fallback`.
const SAME_ORIGIN = "http://same-origin.invalid";
export function safeRedirect(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    if (new URL(value, SAME_ORIGIN).origin !== SAME_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return fallback;
  return value;
}

// «/ruta?x=1#h» de una ubicación de React Router (o de window.location).
export const pathOf = (location) => `${location.pathname}${location.search || ""}${location.hash || ""}`;
