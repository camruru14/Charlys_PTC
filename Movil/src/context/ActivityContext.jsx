import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { api } from "../lib/api";
import { moduleOfKey } from "../lib/activityKeys";
import { onMutation } from "../lib/sessionEvents";
import { useAuth } from "../hooks/useAuth";

// Novedades de la app, por usuario: mismo contexto que
// Web/private/frontend/src/context/ActivityContext.jsx, con las mismas reglas.
// Trae del backend (GET /activity/counts) qué registros son nuevos o cambiaron
// para el usuario en cada pestaña:
//   counts   { "fabricacion.pedidos": 1, … }      (registros distintos, no acciones)
//   modules  { fabricacion: 1, … }                (suma de las pestañas de cada módulo)
//   unseen   { "fabricacion.pedidos": Set(ids) }  (los registros que se marcan en las listas)
// Se vuelve a pedir al abrir, cada 30 s en primer plano, al volver a primer
// plano y poco después de cualquier escritura exitosa (lib/api.js avisa).
//
// Abrir una pestaña NO limpia nada: solo tocar un registro (markSeen) o
// «Marcar todo como visto» (markAllSeen). Ambos actualizan la vista al
// instante y luego confirman con el servidor; mientras no confirma, lo marcado
// no reaparece aunque llegue un conteo viejo.
export const ActivityContext = createContext(null);

const POLL_MS = 30000;
const DEBOUNCE_MS = 400;
const EMPTY = { counts: {}, modules: {}, unseen: {} };

// { counts, modules, unseen }: modules suma las pestañas de cada módulo.
function build(counts, unseen) {
  const modules = {};
  Object.entries(counts).forEach(([key, count]) => {
    modules[moduleOfKey(key)] = (modules[moduleOfKey(key)] || 0) + count;
  });
  return { counts, modules, unseen };
}

export function ActivityProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(EMPTY);
  // Copia de `data` para leerla en los manejadores, última respuesta aceptada y
  // lo marcado que el servidor aún no confirmó ({ key → Set(ids) } y claves de «todo»).
  const dataRef = useRef(EMPTY);
  const latest = useRef(0);
  const pending = useRef({ ids: new Map(), all: new Set() });

  const commit = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  // Muestra los conteos del servidor, salvo lo que el usuario ya marcó y aún no se confirma.
  const apply = useCallback(
    (raw) => {
      const counts = { ...(raw?.counts || {}) };
      const unseen = {};
      Object.keys(counts).forEach((key) => {
        let ids = new Set(raw?.unseen?.[key] || []);
        if (pending.current.all.has(key)) {
          counts[key] = 0;
          ids = new Set();
        } else {
          pending.current.ids.get(key)?.forEach((id) => {
            if (ids.delete(id)) counts[key] = Math.max(0, counts[key] - 1);
          });
        }
        unseen[key] = ids;
      });
      commit(build(counts, unseen));
    },
    [commit],
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    latest.current += 1;
    const seq = latest.current;
    try {
      const raw = await api.get("/activity/counts");
      if (seq === latest.current) apply(raw);
    } catch {
      // Las novedades son un extra: si falla, se conserva lo que había.
    }
  }, [apply, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Sin sesión no hay novedades (y al cerrar sesión no se arrastran al siguiente usuario).
      commit(EMPTY);
      pending.current = { ids: new Map(), all: new Set() };
      return undefined;
    }
    let debounce;
    let timer;
    const startTimer = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (AppState.currentState === "active") refresh();
      }, POLL_MS);
    };
    const first = setTimeout(refresh, 0);
    startTimer();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        startTimer();
      }
    });
    const offMutation = onMutation(() => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(first);
      clearTimeout(debounce);
      clearInterval(timer);
      appState.remove();
      offMutation();
    };
  }, [isAuthenticated, refresh, commit]);

  // POST /activity/seen y, al terminar, los conteos que responde el servidor.
  const confirm = useCallback(
    async (body, done) => {
      latest.current += 1;
      const seq = latest.current;
      try {
        const raw = await api.post("/activity/seen", body);
        done();
        if (seq === latest.current) apply(raw);
      } catch {
        done();
        refresh();
      }
    },
    [apply, refresh],
  );

  // El usuario abrió el registro `id` en la pestaña `key`: se quita la marca al instante.
  const markSeen = useCallback(
    (key, id) => {
      if (!key || !id) return;
      const sid = String(id);
      const d = dataRef.current;
      // Solo lo que está marcado se confirma con el servidor.
      if (!d.unseen[key]?.has(sid)) return;
      const ids = new Set(d.unseen[key]);
      ids.delete(sid);
      commit(build({ ...d.counts, [key]: Math.max(0, (d.counts[key] || 0) - 1) }, { ...d.unseen, [key]: ids }));
      const set = pending.current.ids.get(key) || new Set();
      set.add(sid);
      pending.current.ids.set(key, set);
      confirm({ key, entityId: sid }, () => {
        set.delete(sid);
        if (!set.size) pending.current.ids.delete(key);
      });
    },
    [commit, confirm],
  );

  // «Marcar todo como visto» en una pestaña.
  const markAllSeen = useCallback(
    (key) => {
      if (!key) return;
      const d = dataRef.current;
      commit(build({ ...d.counts, [key]: 0 }, { ...d.unseen, [key]: new Set() }));
      pending.current.all.add(key);
      confirm({ key, all: true }, () => pending.current.all.delete(key));
    },
    [commit, confirm],
  );

  const value = useMemo(
    () => ({
      counts: data.counts,
      modules: data.modules,
      isUnseen: (key, id) => Boolean(id) && Boolean(data.unseen[key]?.has(String(id))),
      markSeen,
      markAllSeen,
    }),
    [data, markSeen, markAllSeen],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export default ActivityContext;
