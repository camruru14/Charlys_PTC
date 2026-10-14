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
// Abrir una pestaña NO limpia nada: solo tocar un registro (markSeen /
// markSeenMany) o «Marcar todo como visto» (markAllSeen). Ambos actualizan la
// vista al instante y luego confirman con el servidor.
//
// Lo marcado queda «pendiente» y se oculta de cualquier respuesta que pudo
// calcularse antes de que el servidor guardara el visto. Cada petición (GET o
// POST) toma un número de secuencia al EMPEZAR; cuando el POST responde OK, el
// pendiente anota el contador de ese momento (`confirmedAt`): una respuesta que
// empezó antes (startSeq <= confirmedAt) pudo ser vieja y se sigue ocultando; una
// que empezó después es confiable, el pendiente se suelta y se respeta lo que diga
// el servidor. Una respuesta solo se aplica si es más nueva que la última aplicada.
export const ActivityContext = createContext(null);

const POLL_MS = 30000;
const DEBOUNCE_MS = 400;
const EMPTY = { counts: {}, modules: {}, unseen: {} };
const newPending = () => ({ ids: new Map(), all: new Map() });

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
  // Copia de `data` para leerla en los manejadores, contador de peticiones, número
  // de la última respuesta aplicada y lo marcado que aún no es confiable:
  // ids { key → Map(id → { confirmedAt }) } y all { key → { confirmedAt } };
  // confirmedAt es null hasta que el POST responde.
  const dataRef = useRef(EMPTY);
  const seqCounter = useRef(0);
  const lastApplied = useRef(0);
  const pending = useRef(newPending());

  const commit = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  // Muestra los conteos del servidor (pedidos en `startSeq`), salvo lo marcado que
  // esa respuesta aún no puede reflejar.
  const apply = useCallback(
    (raw, startSeq) => {
      if (startSeq <= lastApplied.current) return;
      lastApplied.current = startSeq;
      const trusted = (entry) => entry.confirmedAt !== null && startSeq > entry.confirmedAt;
      const counts = { ...(raw?.counts || {}) };
      const unseen = {};
      Object.keys(counts).forEach((key) => {
        let ids = new Set(raw?.unseen?.[key] || []);
        const all = pending.current.all.get(key);
        if (all && trusted(all)) pending.current.all.delete(key);
        if (pending.current.all.has(key)) {
          counts[key] = 0;
          ids = new Set();
        }
        const marked = pending.current.ids.get(key);
        marked?.forEach((entry, id) => {
          if (trusted(entry)) {
            marked.delete(id);
          } else if (ids.delete(id)) {
            counts[key] = Math.max(0, counts[key] - 1);
          }
        });
        if (marked && !marked.size) pending.current.ids.delete(key);
        unseen[key] = ids;
      });
      commit(build(counts, unseen));
    },
    [commit],
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const startSeq = (seqCounter.current += 1);
    try {
      apply(await api.get("/activity/counts"), startSeq);
    } catch {
      // Las novedades son un extra: si falla, se conserva lo que había.
    }
  }, [apply, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Sin sesión no hay novedades (y al cerrar sesión no se arrastran al siguiente usuario).
      commit(EMPTY);
      pending.current = newPending();
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

  // POST /activity/seen. Si responde OK, los pendientes `entries` anotan el momento
  // (confirmedAt) y se aplican los conteos de la respuesta; si falla se sueltan
  // (`release`), se avisa en consola y se vuelve a pedir el estado real.
  const confirm = useCallback(
    async (body, entries, release) => {
      const startSeq = (seqCounter.current += 1);
      try {
        const raw = await api.post("/activity/seen", body);
        entries.forEach((entry) => {
          entry.confirmedAt = seqCounter.current;
        });
        apply(raw, startSeq);
      } catch (error) {
        release();
        console.warn("[novedades] no se pudo marcar visto", body.key, body.all ? "todo" : body.entityIds, error);
        refresh();
      }
    },
    [apply, refresh],
  );

  // El usuario abrió los registros `ids` en la pestaña `key`: se quita la marca al
  // instante y se confirma con UN solo POST.
  const markSeenMany = useCallback(
    (key, ids) => {
      if (!key || !Array.isArray(ids)) return;
      const d = dataRef.current;
      const marked = d.unseen[key];
      // Solo lo que está marcado se confirma con el servidor.
      const fresh = [...new Set(ids.filter(Boolean).map(String))].filter((id) => marked?.has(id));
      if (!fresh.length) return;
      const rest = new Set(marked);
      fresh.forEach((id) => rest.delete(id));
      commit(build({ ...d.counts, [key]: Math.max(0, (d.counts[key] || 0) - fresh.length) }, { ...d.unseen, [key]: rest }));
      const map = pending.current.ids.get(key) || new Map();
      const entries = fresh.map((id) => {
        const entry = { confirmedAt: null };
        map.set(id, entry);
        return [id, entry];
      });
      pending.current.ids.set(key, map);
      confirm({ key, entityIds: fresh }, entries.map(([, entry]) => entry), () => {
        entries.forEach(([id, entry]) => {
          if (map.get(id) === entry) map.delete(id);
        });
        if (!map.size && pending.current.ids.get(key) === map) pending.current.ids.delete(key);
      });
    },
    [commit, confirm],
  );

  const markSeen = useCallback((key, id) => markSeenMany(key, [id]), [markSeenMany]);

  // «Marcar todo como visto» en una pestaña.
  const markAllSeen = useCallback(
    (key) => {
      if (!key) return;
      const d = dataRef.current;
      commit(build({ ...d.counts, [key]: 0 }, { ...d.unseen, [key]: new Set() }));
      const entry = { confirmedAt: null };
      pending.current.all.set(key, entry);
      confirm({ key, all: true }, [entry], () => {
        if (pending.current.all.get(key) === entry) pending.current.all.delete(key);
      });
    },
    [commit, confirm],
  );

  const value = useMemo(
    () => ({
      counts: data.counts,
      modules: data.modules,
      isUnseen: (key, id) => Boolean(id) && Boolean(data.unseen[key]?.has(String(id))),
      markSeen,
      markSeenMany,
      markAllSeen,
    }),
    [data, markSeen, markSeenMany, markAllSeen],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export default ActivityContext;
