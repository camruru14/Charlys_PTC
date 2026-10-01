import { useCallback, useMemo } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";
import { useDateRange } from "../context/DateRangeContext";
import { dayKey } from "../lib/logistics";

// GET /routes?from=&to= (private/backend): todas las rutas sin completar (sin
// importar su fecha) más las completadas dentro del rango de fechas global (por
// defecto, esta semana); una ruta = un
// motorista, un vehículo y varios pedidos), más GET /routes/availability
// (motoristas y vehículos con su disponibilidad del día). Las acciones son
// los mismos endpoints que Web/private/frontend/src/pages/logistica/: cada
// una responde la ruta actualizada y recarga rutas y disponibilidad. Los
// pedidos cambian con cada acción: la pantalla recarga useOrders aparte.
export function useRoutes() {
  // Rango de las completadas (el selector de la cabecera de Logística). «Todo»
  // (sin rango) parte de 1970; con un rango relativo («Esta semana», «Últimos 7
  // días»…) el final es siempre hoy, aunque pase la medianoche con la app
  // abierta. El refresco automático usa esta misma ruta: respeta el rango.
  const range = useDateRange();
  const routesPath = `/routes?from=${range.from ? dayKey(range.from) : "1970-01-01"}&to=${range.preset || !range.to ? dayKey(new Date()) : dayKey(range.to)}`;
  const { data, loading, refreshing, error, refresh: refreshList, refreshQuiet: refreshListQuiet } = useApi(routesPath);
  const { data: availability, refresh: refreshAvailability, refreshQuiet: refreshAvailabilityQuiet } = useApi("/routes/availability");

  const routes = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const refresh = useCallback(
    () => Promise.all([refreshList(), refreshAvailability()]),
    [refreshList, refreshAvailability],
  );

  // Lectura en segundo plano (sin spinner ni errores); ver useAutoRefresh.
  const refreshQuiet = useCallback(
    () => Promise.all([refreshListQuiet(), refreshAvailabilityQuiet()]),
    [refreshListQuiet, refreshAvailabilityQuiet],
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

  // POST /routes { zone, driver?, vehicle? }: el backend asigna el código R-AAAA-NNNN.
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
    loading,
    refreshing,
    error,
    refresh,
    refreshQuiet,
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
