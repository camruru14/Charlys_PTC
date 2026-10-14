import { useCallback, useEffect, useState } from "react";
import { API_URL, api, setAuthToken } from "../lib/api";
import { AuthContext } from "./authContextValue";

// Provider de la sesión: evita "prop drilling" al compartirla entre todas las vistas.

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

  // Guarda o limpia la sesión en estado + localStorage.
  const persistSession = useCallback((nextUser, nextToken) => {
    if (!nextUser) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
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

  // Actualiza los datos del usuario en sesión (p. ej. tras cambiar el correo
  // en Configuración > Mi cuenta). Si el backend entregó un token nuevo (cambiar
  // la contraseña propia cierra las demás sesiones y renueva esta), se pasa en
  // `token` y se guarda igual que en el login; si no, se conserva el actual.
  const updateUser = useCallback(
    (changes, token) => {
      const stored = readStoredSession();
      if (!stored?.user) return;
      persistSession({ ...stored.user, ...changes }, token || stored.token);
    },
    [persistSession],
  );

  // Al abrir con una sesión guardada, `isAdmin`, `department` y `position` se vuelven a leer de /auth/me:
  // lo guardado es del último login y pudo cambiar desde entonces (botones de admin que sobran o
  // faltan, y los módulos que da el puesto: canManageAttendance).
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    let ignore = false;
    api
      .get("/auth/me")
      .then((me) => {
        if (ignore || !me) return;
        const saved = readStoredSession()?.user;
        const changes = {};
        if (typeof me.isAdmin === "boolean" && me.isAdmin !== saved?.isAdmin) changes.isAdmin = me.isAdmin;
        for (const field of ["department", "position"]) {
          if (typeof me[field] === "string" && me[field] !== (saved?.[field] ?? "")) changes[field] = me[field];
        }
        if (Object.keys(changes).length) updateUser(changes);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [userId, updateUser]);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    updateUser,
    apiUrl: API_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
