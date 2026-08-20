import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /orders (private/backend): pedidos del e-commerce. A diferencia de la
// web (que reparte este flujo en 4 pestañas — Pedidos, Inventario > Pedidos,
// Fabricación > Pedidos, Logística), la app móvil consolida todas las
// acciones en una sola pantalla de detalle (PedidoDetalleScreen), así que
// este hook expone una función por cada PATCH/PUT/DELETE que ese flujo
// necesita, todas sobre el mismo `/orders`.
export function useOrders() {
  // crear/actualizar (Fase 10): el panel web sí permite crear pedidos a mano
  // (ej. telefónicos/mostrador) y editar cliente/productos de uno existente —
  // contra lo que decía este comentario antes, no es algo que la app deba
  // evitar. `eliminar` sigue siendo la única acción "de emergencia" real (no
  // tiene equivalente de negocio normal, un pedido no se "cancela" desde acá
  // salvo error).
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi("/orders");

  const requestInventory = useCallback(
    async (id) => {
      const result = await api.patch(`/orders/${id}/request-inventory`);
      await refresh();
      return result;
    },
    [refresh],
  );

  // Deshace "Solicitar a inventario" (DELETE al mismo endpoint que
  // requestInventory) — usado por "Eliminar" en el tab Pedidos de
  // Inventario.
  const cancelInventoryRequest = useCallback(
    async (id) => {
      const result = await api.del(`/orders/${id}/request-inventory`);
      await refresh();
      return result;
    },
    [refresh],
  );

  const verifyItem = useCallback(
    async (id, index, warehouse) => {
      const result = await api.patch(`/orders/${id}/items/${index}/verify`, { warehouse });
      await refresh();
      return result;
    },
    [refresh],
  );

  const packItem = useCallback(
    async (id, index) => {
      const result = await api.patch(`/orders/${id}/items/${index}/pack`);
      await refresh();
      return result;
    },
    [refresh],
  );

  const sendToManufacturing = useCallback(
    async (id, index) => {
      const result = await api.patch(`/orders/${id}/items/${index}/send-manufacturing`);
      await refresh();
      return result;
    },
    [refresh],
  );

  // Deshace "Enviar a fabricar" (mismo endpoint que sendToManufacturing,
  // método DELETE) — usado por "Eliminar" en el tab "Por fabricar" de
  // Fabricación.
  const removeFromManufacturing = useCallback(
    async (id, index) => {
      const result = await api.del(`/orders/${id}/items/${index}/send-manufacturing`);
      await refresh();
      return result;
    },
    [refresh],
  );

  const manufactureItem = useCallback(
    async (id, index) => {
      const result = await api.patch(`/orders/${id}/items/${index}/manufacture`);
      await refresh();
      return result;
    },
    [refresh],
  );

  const packManufacturedItem = useCallback(
    async (id, index) => {
      const result = await api.patch(`/orders/${id}/items/${index}/pack-manufactured`);
      await refresh();
      return result;
    },
    [refresh],
  );

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

  // No hay endpoint dedicado solo para paymentStatus: se manda con PUT el
  // pedido completo, igual que pages/Pedidos.jsx en el panel web. `items` se
  // manda tal cual salvo `manufacturingBatch`, que en el GET viene poblado
  // ({_id, batchNumber, status}) y hay que reducir a solo el id para que el
  // backend lo pueda castear de vuelta a ObjectId.
  const updatePaymentStatus = useCallback(
    async (order, paymentStatus) => {
      const payload = {
        customer: order.customer,
        items: (order.items || []).map((item) => ({
          ...item,
          manufacturingBatch: item.manufacturingBatch?._id || item.manufacturingBatch || undefined,
        })),
        total: order.total,
        status: order.status,
        paymentStatus,
        notes: order.notes,
      };
      const result = await api.put(`/orders/${order._id}`, payload);
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
    requestInventory,
    cancelInventoryRequest,
    verifyItem,
    packItem,
    sendToManufacturing,
    removeFromManufacturing,
    manufactureItem,
    packManufacturedItem,
    assignDelivery,
    confirmPickup,
    updatePaymentStatus,
  };
}

export default useOrders;
