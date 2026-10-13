import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /transactions (private/backend): ingresos y gastos.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// Finanzas: PATCH /:id/pay marca un movimiento como pagado y la factura va en
// POST /:id/attachment (campo "file") y DELETE /:id/attachment. Las ventas de
// la tienda (relatedOrder u orderNumber) responden 409 en todo eso.
export function useTransactions() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/transactions");

  const pagar = useCallback(
    async (id) => {
      const result = await api.patch(`/transactions/${id}/pay`);
      await refresh();
      return result;
    },
    [refresh],
  );

  // file: { uri, name, type } de expo-image-picker.
  const subirFactura = useCallback(
    async (id, file) => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post(`/transactions/${id}/attachment`, formData);
      await refresh();
      return result;
    },
    [refresh],
  );

  const quitarFactura = useCallback(
    async (id) => {
      const result = await api.del(`/transactions/${id}/attachment`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    transactions: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    pagar,
    subirFactura,
    quitarFactura,
  };
}

export default useTransactions;
