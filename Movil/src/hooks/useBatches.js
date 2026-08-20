import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /productionBatches (private/backend): lotes de fabricación.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// reportar/deshacerReporte (Fase 4): PATCH/DELETE /:id/report — "Reportar"
// también actualiza el status del lote a "En Proceso" si estaba
// "Programado" del lado del backend, así que acá solo hace falta refrescar.
export function useBatches() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi(
    "/productionBatches",
  );

  const reportar = useCallback(
    async (id, { producedQuantity, warehouse }) => {
      const result = await api.patch(`/productionBatches/${id}/report`, { producedQuantity, warehouse });
      await refresh();
      return result;
    },
    [refresh],
  );

  const deshacerReporte = useCallback(
    async (id) => {
      const result = await api.del(`/productionBatches/${id}/report`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    batches: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    reportar,
    deshacerReporte,
  };
}

export default useBatches;
