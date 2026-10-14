import { useContext, useEffect } from "react";
import { ActivityContext } from "../context/activityContextValue";

// { counts, modules, markSeen, watch } de las burbujas de novedades.
export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used within an ActivityProvider");
  return context;
}

// Marca la pestaña `key` como vista al abrirla y mientras siga abierta (lo que
// llegue se marca solo). `key` null no hace nada. Úsalo con la pestaña activa:
// al cambiar de pestaña, la anterior deja de vigilarse y la nueva se marca.
export function useMarkSeen(key) {
  const { watch } = useActivity();
  useEffect(() => (key ? watch(key) : undefined), [key, watch]);
}

export default useActivity;
