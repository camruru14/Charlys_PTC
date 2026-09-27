import { useMemo } from "react";
import { useFetch } from "./useFetch";

/*
  Líneas de producción (Configuración > Líneas de producción).
    const { lines, options } = useProductionLines();
  - lines: todas, con { _id, name, active, inProcess }.
  - options: nombres de las activas, para elegir al crear o iniciar un lote.
  withCurrentLine(options, lote.productionLine) agrega la línea que ya tenga
  el lote aunque esté desactivada o eliminada, para no perderla al editar.
*/
export function useProductionLines() {
  const { data, loading, error, refetch, mutate } = useFetch("/productionLines");
  const lines = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const options = useMemo(() => lines.filter((l) => l.active).map((l) => l.name), [lines]);
  return { lines, options, loading, error, refetch, mutate };
}

export function withCurrentLine(options, current) {
  return current && !options.includes(current) ? [...options, current] : options;
}

export default useProductionLines;
