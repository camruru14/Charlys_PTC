import { useApi } from "./useApi";

// GET /vehicles (private/backend): flota de reparto.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
export function useVehicles() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/vehicles");

  return {
    vehicles: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useVehicles;
