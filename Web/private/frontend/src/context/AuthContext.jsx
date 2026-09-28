import { useCallback, useState } from "react";
import { API_URL, setAuthToken } from "../lib/api";
import { AuthContext } from "./authContextValue";

// Provider de la sesión: evita "prop drilling" al compartirla entre todas las vistas.

const SESSION_STORAGE_KEY = "charly:auth-session";
// Contraseña con la que se inició sesión, solo para el ojo de «Contraseña
// actual» en Configuración > Mi cuenta. Va en sessionStorage (solo esta
// pestaña; se borra al cerrarla o al cerrar sesión) y nunca sale del
// navegador: el backend guarda las contraseñas cifradas y no las devuelve.
const SESSION_PASSWORD_KEY = "charly:session-password";

function readSessionPassword() {
  try {
    return sessionStorage.getItem(SESSION_PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

function writeSessionPassword(password) {
  try {
    if (password) sessionStorage.setItem(SESSION_PASSWORD_KEY, password);
    else sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  } catch {
    // Sin acceso al almacenamiento: el ojo pedirá volver a iniciar sesión.
  }
}

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
  // Recuperamos la sesión una sola vez, al crear el estado inicial del
  // provider (localStorage es síncrono, así que no hace falta un efecto ni
  // un estado de carga intermedio).
  const [user, setUser] = useState(() => {
    const stored = readStoredSession();
    // El token también se restaura para api.js: en
    // Safari/iPhone la cookie httpOnly del login no persiste (ver
    // lib/api.js), así que este token de respaldo es el que realmente
    // mantiene la sesión activa después de recargar la página.
    if (stored?.token) {
      setAuthToken(stored.token);
    }
    return stored?.user || null;
  });
  const loading = false;
  const [sessionPassword, setSessionPasswordState] = useState(readSessionPassword);

  // Recuerda (o borra) la contraseña de la sesión en esta pestaña.
  const setSessionPassword = useCallback((password) => {
    writeSessionPassword(password);
    setSessionPasswordState(password || "");
  }, []);

  // Guarda o limpia la sesión en estado + localStorage.
  const persistSession = useCallback((nextUser, nextToken) => {
    if (!nextUser) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      writeSessionPassword("");
      setSessionPasswordState("");
      setUser(null);
      setAuthToken(null);
      return;
    }
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ user: nextUser, token: nextToken, authenticatedAt: new Date().toISOString() }),
    );
    setUser(nextUser);
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
        setSessionPassword(password);
        return { ok: true, message: payload.message || "Sesión iniciada" };
      } catch {
        return { ok: false, message: "No se pudo conectar con el servidor" };
      }
    },
    [persistSession, setSessionPassword],
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

  // Actualiza los datos del usuario en sesión (p. ej. tras cambiar el correo
  // en Configuración > Mi cuenta) sin tocar el token.
  const updateUser = useCallback(
    (changes) => {
      const stored = readStoredSession();
      if (!stored?.user) return;
      persistSession({ ...stored.user, ...changes }, stored.token);
    },
    [persistSession],
  );

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    updateUser,
    sessionPassword,
    setSessionPassword,
    apiUrl: API_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
