import { useCallback, useMemo } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /routes (private/backend): rutas de Logística de hoy (una ruta = un
// motorista, un vehículo y varios pedidos), más GET /routes/availability
// (motoristas y vehículos con su disponibilidad del día). Las acciones son
// los mismos endpoints que Web/private/frontend/src/pages/logistica/: cada
// una responde la ruta actualizada y recarga rutas y disponibilidad. Los
// pedidos cambian con cada acción: la pantalla recarga useOrders aparte.
export function useRoutes() {
  const { data, loading, refreshing, error, refresh: refreshList } = useApi("/routes");
  const { data: availability, refresh: refreshAvailability } = useApi("/routes/availability");

  const routes = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  // Correlativo del día: la próxima ruta se crea con este número.
  const nextNumber = useMemo(() => routes.reduce((max, r) => Math.max(max, r.number || 0), 0) + 1, [routes]);

  const refresh = useCallback(
    () => Promise.all([refreshList(), refreshAvailability()]),
    [refreshList, refreshAvailability],
  );

  const run = useCallback(
    async (request) => {
      const result = await request;
      await refresh();
      return result;
    },
    [refresh],
  );

  const url = (id) => `/routes/${id}`;

  // POST /routes { zone, driver?, vehicle? }: el número lo asigna el backend.
  const crear = useCallback((body) => run(api.post("/routes", body)), [run]);
  // PATCH /routes/:id { zone?, driver?, vehicle? } (null quita motorista/vehículo).
  const actualizar = useCallback((id, body) => run(api.patch(url(id), body)), [run]);
  const eliminar = useCallback((id) => run(api.del(url(id))), [run]);
  const addOrder = useCallback((id, orderId) => run(api.post(`${url(id)}/orders`, { orderId })), [run]);
  const removeOrder = useCallback((id, orderId) => run(api.del(`${url(id)}/orders/${orderId}`)), [run]);
  // location: "Almacén" | "Fabricación"
  const confirmPickup = useCallback((id, location) => run(api.patch(`${url(id)}/pickup`, { location })), [run]);
  const depart = useCallback((id) => run(api.patch(`${url(id)}/depart`)), [run]);
  const deliver = useCallback((id, orderId) => run(api.patch(`${url(id)}/orders/${orderId}/deliver`)), [run]);
  const undeliver = useCallback((id, orderId) => run(api.patch(`${url(id)}/orders/${orderId}/undeliver`)), [run]);

  return {
    routes,
    availability,
    nextNumber,
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
    addOrder,
    removeOrder,
    confirmPickup,
    depart,
    deliver,
    undeliver,
  };
}

export default useRoutes;
