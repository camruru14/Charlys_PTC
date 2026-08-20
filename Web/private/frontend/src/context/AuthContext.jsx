import { createContext, useCallback, useEffect, useState } from "react";
import { API_URL, setAuthToken } from "../lib/api";
import { setPublicApiToken } from "../lib/publicApi";

// Contexto global de autenticación del panel administrativo.
// Evita "prop drilling" al compartir la sesión entre todas las vistas.
const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = "charly:auth-session";

/**
 * Lee la sesión guardada en localStorage.
 * Al recargar la página el estado de React se reinicia, por eso
 * recuperamos una versión mínima de la sesión desde localStorage.
 */
function readStoredSession() {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Recuperamos la sesión una sola vez al montar el provider.
  useEffect(() => {
    const stored = readStoredSession();
    if (stored?.user) setUser(stored.user);
    // El token también se restaura -- tanto para publicApi.js (usado por
    // Catalogo.jsx) como para api.js (todo el resto del panel): en
    // Safari/iPhone la cookie httpOnly del login no persiste (ver
    // lib/api.js), así que este token de respaldo es el que realmente
    // mantiene la sesión activa después de recargar la página.
    if (stored?.token) {
      setPublicApiToken(stored.token);
      setAuthToken(stored.token);
    }
    setLoading(false);
  }, []);

  // Guarda o limpia la sesión en estado + localStorage.
  const persistSession = useCallback((nextUser, nextToken) => {
    if (!nextUser) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      setPublicApiToken(null);
      setAuthToken(null);
      return;
    }
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ user: nextUser, token: nextToken, authenticatedAt: new Date().toISOString() }),
    );
    setUser(nextUser);
    setPublicApiToken(nextToken);
    setAuthToken(nextToken);
  }, []);

  // Inicia sesión contra el backend (empleados administrativos).
  const login = useCallback(
    async ({ email, password }) => {
      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          return { ok: false, message: payload.message || "No se pudo iniciar sesión" };
        }

        persistSession(payload.user, payload.token);
        return { ok: true, message: payload.message || "Sesión iniciada" };
      } catch {
        return { ok: false, message: "No se pudo conectar con el servidor" };
      }
    },
    [persistSession],
  );

  // Cierra sesión en backend y frontend.
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      persistSession(null, null);
    }
  }, [persistSession]);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    apiUrl: API_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
export default AuthContext;
