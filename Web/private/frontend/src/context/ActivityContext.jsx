import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, MUTATION_EVENT } from "../lib/api";
import { moduleOfKey } from "../lib/activityKeys";
import { useAuth } from "../hooks/useAuth";
import { ActivityContext } from "./activityContextValue";

/*
  Burbujas de novedades del menú lateral y de las pestañas. Trae del backend
  (GET /activity/counts) cuántos elementos nuevos o cambiados tiene el usuario
  en cada pestaña desde la última vez que la abrió:
    counts   { "fabricacion.pedidos": 1, … }
    modules  { fabricacion: 1, … }  (suma de las pestañas de cada módulo)
  Se vuelve a pedir al cargar, cada 30 s mientras la pestaña del navegador está
  visible, al volver a ella y poco después de cualquier POST/PUT/PATCH/DELETE
  exitoso (lib/api.js avisa con el evento MUTATION_EVENT).

  Pestañas abiertas (watch): al abrirse se marcan vistas (POST /activity/seen) y,
  mientras siguen abiertas, lo que llegue se marca visto solo, sin parpadeo:
  su conteo se ve siempre en 0.
*/
const POLL_MS = 30000;
const DEBOUNCE_MS = 400;
const EMPTY = { counts: {}, modules: {} };

// { counts, modules }: modules suma las pestañas de cada módulo.
function withModules(counts) {
  const modules = {};
  Object.entries(counts).forEach(([key, count]) => {
    modules[moduleOfKey(key)] = (modules[moduleOfKey(key)] || 0) + count;
  });
  return { counts, modules };
}

export function ActivityProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(EMPTY);
  // Pestañas abiertas (con cuántas pantallas la vigilan) y respuesta más reciente aceptada.
  const watched = useRef(new Map());
  const latest = useRef(0);
  const applyRef = useRef(null);

  // POST /activity/seen: el servidor responde los conteos ya actualizados.
  const sendSeen = useCallback(async (key) => {
    const seq = (latest.current += 1);
    try {
      const raw = await api.post("/activity/seen", { key });
      if (seq === latest.current) applyRef.current?.(raw);
    } catch {
      // Sin conexión: la próxima actualización lo reintenta.
    }
  }, []);

  // Muestra los conteos del servidor, salvo en las pestañas abiertas, que se marcan vistas.
  const apply = useCallback(
    (raw) => {
      const counts = { ...(raw?.counts || {}) };
      const open = [...watched.current.keys()].filter((key) => counts[key] > 0);
      open.forEach((key) => {
        counts[key] = 0;
      });
      setData(withModules(counts));
      open.forEach(sendSeen);
    },
    [sendSeen],
  );

  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const seq = (latest.current += 1);
    try {
      const raw = await api.get("/activity/counts");
      if (seq === latest.current) apply(raw);
    } catch {
      // Las burbujas son un extra: si falla, se conserva lo que había.
    }
  }, [apply, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let debounce;
    const visible = () => document.visibilityState === "visible";
    const onVisibility = () => {
      if (visible()) refresh();
    };
    const onMutation = () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, DEBOUNCE_MS);
    };
    // Primera carga: en un timer, no dentro del cuerpo del efecto.
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (visible()) refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(MUTATION_EVENT, onMutation);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(MUTATION_EVENT, onMutation);
    };
  }, [isAuthenticated, refresh]);

  // Marca una pestaña como vista (solo para este usuario).
  const markSeen = useCallback((key) => sendSeen(key), [sendSeen]);

  // Empieza a vigilar una pestaña abierta; devuelve cómo dejar de hacerlo.
  const watch = useCallback(
    (key) => {
      watched.current.set(key, (watched.current.get(key) || 0) + 1);
      // Se ve en 0 de inmediato, sin esperar la respuesta.
      setData((d) => (d.counts[key] > 0 ? withModules({ ...d.counts, [key]: 0 }) : d));
      sendSeen(key);
      return () => {
        const left = (watched.current.get(key) || 1) - 1;
        if (left > 0) watched.current.set(key, left);
        else watched.current.delete(key);
      };
    },
    [sendSeen],
  );

  const value = useMemo(() => ({ ...data, markSeen, watch }), [data, markSeen, watch]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export default ActivityProvider;
