import { useContext, useEffect, useRef } from "react";
import { ActivityContext } from "../context/ActivityContext";

// { counts, modules, isUnseen(key, id), markSeen(key, id), markSeenMany(key, ids), markAllSeen(key) } de las novedades.
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used within an ActivityProvider");
  return context;
}

// Las novedades de UNA pestaña (clave «modulo.pestana»), listas para sus filas:
//   const { isUnseen, markSeen } = useUnseen("pedidos");
//   <OrderCard unseen={isUnseen(order._id)} onPress={() => { markSeen(order._id); abrir(); }} />
// `count` es lo que muestra su burbuja, `markAll` es «Marcar todo como visto» y
// `markSeenMany` marca varios registros con una sola llamada.
export function useUnseen(key) {
  const { counts, isUnseen, markSeen, markSeenMany, markAllSeen } = useActivity();
  return {
    count: counts[key] || 0,
    isUnseen: (id) => isUnseen(key, id),
    markSeen: (id) => markSeen(key, id),
    markSeenMany: (ids) => markSeenMany(key, ids),
    markAll: () => markAllSeen(key),
  };
}

// Para las pantallas de detalle: el registro `openId` (un id o un arreglo) que el
// usuario tiene abierto nunca queda marcado como nuevo. Si una actividad posterior
// (una acción propia o de otro usuario) lo vuelve a marcar mientras sigue abierto,
// se marca visto solo.
//   useAutoSeen("pedidos", orderId);
// Se marca una sola vez por cada aparición (`tried`): si el POST falla no se
// reintenta en bucle; se olvida cuando el registro deja de estar sin ver.
export function useAutoSeen(key, openId) {
  const { isUnseen, markSeenMany } = useActivity();
  const open = (Array.isArray(openId) ? openId : [openId]).filter(Boolean).map(String);
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
}

export default useActivity;
