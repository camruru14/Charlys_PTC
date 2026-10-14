import { useContext } from "react";
import { ActivityContext } from "../context/activityContextValue";

// { counts, modules, isUnseen(key, id), markSeen(key, id), markAllSeen(key) } de las novedades.
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used within an ActivityProvider");
  return context;
}

// Las novedades de UNA pestaña (clave «modulo.pestana»), listas para sus filas:
//   const { isUnseen, markSeen } = useUnseen("pedidos");
//   <Row unseen={isUnseen(order._id)} onClick={() => markSeen(order._id)} />
// `count` es lo que muestra su burbuja y `markAll` es «Marcar todo como visto».
export function useUnseen(key) {
  const { counts, isUnseen, markSeen, markAllSeen } = useActivity();
  return {
    count: counts[key] || 0,
    isUnseen: (id) => isUnseen(key, id),
    markSeen: (id) => markSeen(key, id),
    markAll: () => markAllSeen(key),
  };
}

export default useActivity;
