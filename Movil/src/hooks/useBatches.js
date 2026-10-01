import { useApi } from "./useApi";

// GET /productionBatches (private/backend): lotes de fabricación.
// crear/actualizar/eliminar: POST, PUT y DELETE al mismo recurso. Las
// transiciones del lote (iniciar, detener, completar, enviar a bodega…)
// están en lib/batchActions.js, con los mismos endpoints que la web.
export function useBatches() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi("/productionBatches");

  return {
    batches: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useBatches;
