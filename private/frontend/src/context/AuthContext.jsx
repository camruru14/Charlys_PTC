import { createContext, useCallback, useEffect, useState } from "react";

// Contexto global de autenticación del panel administrativo.
// Evita "prop drilling" al compartir la sesión entre todas las vistas.
const AuthContext = createContext(null);

const API_URL = "http://localhost:4000/api";
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
    setLoading(false);
  }, []);

  // Guarda o limpia la sesión en estado + localStorage.
  const persistSession = useCallback((nextUser) => {
    if (!nextUser) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      return;
    }
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ user: nextUser, authenticatedAt: new Date().toISOString() }),
    );
    setUser(nextUser);
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

        persistSession(payload.user);
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
      persistSession(null);
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
