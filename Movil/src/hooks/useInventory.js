import { useApi } from "./useApi";

// GET /inventory (private/backend): materia prima y producto terminado.
// crear/actualizar/eliminar: CRUD normal de los artículos. El producto
// terminado entra al inventario al enviar un lote a bodega desde Fabricación
// (lib/batchActions.js), como en la web.
export function useInventory() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi("/inventory");

  return {
    items: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useInventory;
