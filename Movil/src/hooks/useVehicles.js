import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /vehicles (private/backend): flota de reparto.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// La foto: POST /vehicles/:id/image (campo "image") y DELETE /vehicles/:id/image;
// ambos responden el vehículo actualizado.
export function useVehicles() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/vehicles");

  // file: { uri, name, type } de expo-image-picker.
  const subirFoto = useCallback(
    async (id, file) => {
      const formData = new FormData();
      formData.append("image", file);
      const result = await api.post(`/vehicles/${id}/image`, formData);
      await refresh();
      return result;
    },
    [refresh],
  );

  const quitarFoto = useCallback(
    async (id) => {
      const result = await api.del(`/vehicles/${id}/image`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    vehicles: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    subirFoto,
    quitarFoto,
  };
}

export default useVehicles;
