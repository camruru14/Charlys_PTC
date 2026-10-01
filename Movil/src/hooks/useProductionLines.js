import { useMemo } from "react";
import { useApi } from "./useApi";

// Líneas de producción (Configuración > Líneas de producción), como
// hooks/useProductionLines.js de la web.
//   - lines: todas, con { _id, name, active, inProcess }.
//   - options: nombres de las activas, para elegir al crear o iniciar un lote.
export function useProductionLines() {
  const { data, loading, error, refresh } = useApi("/productionLines");
  const lines = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const options = useMemo(() => lines.filter((l) => l.active).map((l) => l.name), [lines]);
  return { lines, options, loading, error, refresh };
}

// Agrega la línea que ya tenga el lote aunque esté desactivada o eliminada,
// para no perderla al editar.
export function withCurrentLine(options, current) {
  return current && !options.includes(current) ? [...options, current] : options;
}

export default useProductionLines;
