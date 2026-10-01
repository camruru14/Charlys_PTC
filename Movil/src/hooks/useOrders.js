import { useApi } from "./useApi";

// GET /orders (private/backend): pedidos del e-commerce. Solo se consultan: no
// se crean ni se editan desde el panel; `eliminar` (solo administradores) borra
// un pedido ya entregado, como en la web. Las acciones de preparación de cada línea
// (verificar, empacar, enviar a fabricación…) están en lib/inventoryOrders.js,
// las de los lotes de pedido en lib/batchActions.js y el despacho (rutas) en
// hooks/useRoutes.js.
export function useOrders() {
  const { data, loading, refreshing, error, refresh, eliminar } = useApi("/orders");

  return {
    orders: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    eliminar,
  };
}

export default useOrders;
