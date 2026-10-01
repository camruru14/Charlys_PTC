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
