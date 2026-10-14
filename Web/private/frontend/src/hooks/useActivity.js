import { useContext, useEffect, useRef } from "react";
import { ActivityContext } from "../context/activityContextValue";

// { counts, modules, isUnseen(key, id), markSeen(key, id), markSeenMany(key, ids), markAllSeen(key) } de las novedades.
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used within an ActivityProvider");
  return context;
}

// Las novedades de UNA pestaña (clave «modulo.pestana»), listas para sus filas:
//   const { isUnseen, markSeen } = useUnseen("pedidos", { openId: selectedId });
//   <Row unseen={isUnseen(order._id)} onClick={() => markSeen(order._id)} />
// `count` es lo que muestra su burbuja, `markAll` es «Marcar todo como visto» y
// `markSeenMany` marca varios registros con una sola llamada.
//
// `openId` es el registro (o registros: un id o un arreglo) que el usuario tiene
// abierto o seleccionado en un panel de detalle. Ese registro NUNCA se ve como
// nuevo mientras siga abierto, y si una actividad nueva (una acción propia o de otro
// usuario) lo vuelve a marcar, se marca visto solo.
export function useUnseen(key, { openId } = {}) {
  const { counts, isUnseen, markSeen, markSeenMany, markAllSeen } = useActivity();
  const open = (Array.isArray(openId) ? openId : [openId]).filter(Boolean).map(String);
  const isOpen = (id) => open.includes(String(id));

  // Abiertos que el contexto tiene sin ver. Se marcan una vez cada uno: `tried` evita
  // reintentar sin parar si el POST falla (se olvida cuando el registro deja de estar
  // sin ver, para que una novedad posterior se vuelva a marcar).
  const tried = useRef(new Set());
  const stale = open.filter((id) => isUnseen(key, id)).join(",");
  useEffect(() => {
    const ids = stale ? stale.split(",") : [];
    tried.current.forEach((id) => {
      if (!ids.includes(id)) tried.current.delete(id);
    });
    const fresh = ids.filter((id) => !tried.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => tried.current.add(id));
    markSeenMany(key, fresh);
  }, [key, stale, markSeenMany]);

  return {
    count: counts[key] || 0,
    isUnseen: (id) => !isOpen(id) && isUnseen(key, id),
    markSeen: (id) => markSeen(key, id),
    markSeenMany: (ids) => markSeenMany(key, ids),
    markAll: () => markAllSeen(key),
  };
}

export default useActivity;
