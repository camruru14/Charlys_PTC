import { useCallback, useMemo } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// Líneas de producción (Configuración > Líneas de producción), como
// hooks/useProductionLines.js y LineasProduccion.jsx de la web.
//   - lines: todas, con { _id, name, active, inProcess }.
//   - options: nombres de las activas, para elegir al crear o iniciar un lote.
//   - crear({ name }), actualizar(id, { name?, active? }) (PATCH: renombrar
//     también actualiza los lotes que la usan) y eliminar(id).
export function useProductionLines() {
  const { data, loading, refreshing, error, refresh, crear, eliminar } = useApi("/productionLines");
  const lines = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const options = useMemo(() => lines.filter((l) => l.active).map((l) => l.name), [lines]);

  const actualizar = useCallback(
    async (id, changes) => {
      const result = await api.patch(`/productionLines/${id}`, changes);
      await refresh();
      return result;
    },
    [refresh],
  );

  return { lines, options, loading, refreshing, error, refresh, crear, actualizar, eliminar };
}

// Agrega la línea que ya tenga el lote aunque esté desactivada o eliminada,
// para no perderla al editar.
export function withCurrentLine(options, current) {
  return current && !options.includes(current) ? [...options, current] : options;
}

export default useProductionLines;
