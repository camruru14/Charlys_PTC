import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /inventory (private/backend): materia prima, producto terminado y
// lotes reportados. crear/actualizar/eliminar (Fase 8): CRUD normal de
// "Artículos en almacén". enviarAAlmacen (Fase 4): PATCH /:id/send.
// eliminarReporte (Fase 8): DELETE /:id/report — quita un artículo de
// "Lotes Reportados" sin tocar el lote en Fabricación (ver comentario en
// InventarioScreen).
export function useInventory() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi("/inventory");

  const enviarAAlmacen = useCallback(
    async (id) => {
      const result = await api.patch(`/inventory/${id}/send`);
      await refresh();
      return result;
    },
    [refresh],
  );

  const eliminarReporte = useCallback(
    async (id) => {
      const result = await api.del(`/inventory/${id}/report`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    items: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    enviarAAlmacen,
    eliminarReporte,
  };
}

export default useInventory;
