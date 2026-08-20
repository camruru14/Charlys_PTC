import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /dailyBatches (private/backend): programación previa de lotes.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// `programar` convierte el lote diario en un lote de fabricación (PATCH
// /:id/schedule) y lo quita de esta lista; quien llama también debe
// recargar useBatches(), ya que ese lote nuevo vive en otro hook.
export function useDailyBatches() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/dailyBatches");

  const programar = useCallback(
    async (id) => {
      const result = await api.patch(`/dailyBatches/${id}/schedule`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    dailyBatches: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    programar,
  };
}

export default useDailyBatches;
