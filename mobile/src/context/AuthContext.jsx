import { createContext, useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setTokenGetter } from "../lib/api";
import { onUnauthorized } from "../lib/sessionEvents";

// Contexto global de autenticación de la app móvil. Equivalente a
// Web/private/frontend/src/context/AuthContext.jsx, pero en vez de una
// cookie httpOnly + localStorage, guarda el JWT en expo-secure-store
// (cifrado con Keystore/Keychain del sistema operativo) — NUNCA en
// AsyncStorage, que no está pensado para credenciales.
const AuthContext = createContext(null);

// SecureStore solo permite alfanuméricos, ".", "-" y "_" en las keys (nada
// de ":" ni otros separadores).
const TOKEN_KEY = "charly-auth-token";
const USER_KEY = "charly-auth-user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Copia en memoria del token que lee src/lib/api.js en cada request, para
  // no golpear SecureStore (I/O nativo) en cada llamada a la API.
  const tokenRef = useRef(null);

  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
  }, []);

  // Al montar la app, intenta recuperar la sesión guardada para no pedir
  // login cada vez que se abre la app. Si hay token, se asume la sesión
  // válida hasta que algún request devuelva 401/403 (mismo criterio que la
  // web) — ver el useEffect de más abajo, que borra la sesión apenas
  // cualquier pantalla reciba uno.
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (storedToken) {
          tokenRef.current = storedToken;
          setToken(storedToken);
          setUser(storedUser ? JSON.parse(storedUser) : null);
        }
      } catch {
        // SecureStore corrupto o inaccesible: se ignora y queda sin sesión.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Guarda o limpia la sesión en estado + SecureStore.
  const persistSession = useCallback(async (nextToken, nextUser) => {
    if (!nextToken) {
      tokenRef.current = null;
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
      setToken(null);
      setUser(null);
      return;
    }

    tokenRef.current = nextToken;
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, nextToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)),
    ]);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  // Sesión expirada, centralizado (Fase 5): src/lib/api.js y publicApi.js
  // avisan acá apenas CUALQUIER request devuelve 401/403 (ver
  // sessionEvents.js), sin que cada pantalla tenga que acordarse de llamar
  // a logout() por su cuenta. Borrar el token alcanza — RootNavigator ya
  // reacciona solo a `isAuthenticated` y muestra LoginScreen, mismo
  // criterio que window.location.assign("/login") en el panel web.
  useEffect(() => {
    return onUnauthorized(() => {
      persistSession(null, null);
    });
  }, [persistSession]);

  // Inicia sesión contra el backend (empleados administrativos).
  const login = useCallback(
    async ({ email, password }) => {
      try {
        const payload = await api.post("/auth/login", { email, password });
        await persistSession(payload.token, payload.user);
        return { ok: true, message: payload.message || "Sesión iniciada" };
      } catch (error) {
        return {
          ok: false,
          message: error.message || "No se pudo iniciar sesión",
        };
      }
    },
    [persistSession],
  );

  // Cierra sesión en backend (best-effort, el token ya no sería válido de
  // todas formas) y limpia la sesión local.
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Con token no es estrictamente necesario que el backend confirme el
      // logout: lo importante es borrar la sesión guardada en el celular.
    } finally {
      await persistSession(null, null);
    }
  }, [persistSession]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
export default AuthContext;
