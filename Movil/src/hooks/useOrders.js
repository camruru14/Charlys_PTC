import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /orders (private/backend): pedidos del e-commerce, con crear/editar/
// eliminar como en la web. Las acciones de preparación de cada línea
// (verificar, empacar, enviar a fabricación…) están en lib/inventoryOrders.js
// y las de los lotes de pedido en lib/batchActions.js.
export function useOrders() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi("/orders");

  // Pendiente de revisar con el rediseño de Logística: la web ya asigna la
  // entrega y confirma la recolección a través de las rutas (/routes).
  const assignDelivery = useCallback(
    async (id, payload) => {
      const result = await api.patch(`/orders/${id}/delivery`, payload);
      await refresh();
      return result;
    },
    [refresh],
  );

  const confirmPickup = useCallback(
    async (id, location) => {
      const result = await api.patch(`/orders/${id}/delivery/pickup`, { location });
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    orders: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    assignDelivery,
    confirmPickup,
  };
}

export default useOrders;
