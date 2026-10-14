// Mini "event emitter" para notificar sesión expirada desde el cliente HTTP
// (api.js -> private/backend) hacia AuthContext, sin que ese módulo necesite
// conocer React ni React Navigation. AuthContext se suscribe una sola vez
// al montarse; cualquier 401/403 del backend dispara
// el mismo logout, y RootNavigator ya reacciona solo a `isAuthenticated`
// pasando a LoginScreen — no hace falta un `navigation.navigate` explícito.
let listeners = [];

export function onUnauthorized(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function emitUnauthorized() {
  listeners.forEach((listener) => listener());
}

// Aviso de que una escritura (POST/PUT/PATCH/DELETE) terminó bien: el contexto
// de novedades (context/ActivityContext.jsx) vuelve a pedir sus conteos. Las
// llamadas a /activity no lo emiten (no se piden a sí mismas).
let mutationListeners = [];

export function onMutation(listener) {
  mutationListeners.push(listener);
  return () => {
    mutationListeners = mutationListeners.filter((l) => l !== listener);
  };
}

export function emitMutation() {
  mutationListeners.forEach((listener) => listener());
}
