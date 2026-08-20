import { useApi } from "./useApi";

// GET /warehouses (private/backend): bodegas.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
export function useWarehouses() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/warehouses");

  return {
    warehouses: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useWarehouses;
