import { useApi } from "./useApi";

// GET /dashboard (private/backend): el resumen ejecutivo que muestra DashboardScreen — KPIs con su
// período anterior y mini series, ventas y gastos de 12 meses, ventas por producto, producción
// diaria, pedidos activos y gastos por categoría (misma respuesta que lee
// Web/private/frontend/src/pages/Dashboard.jsx). `range` agrega los query params from/to — el
// cálculo real lo hace el backend; "Todo" (sin range) sigue pegándole a /dashboard tal cual.
export function useDashboard(range) {
  const path =
    range?.from && range?.to
      ? `/dashboard?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      : "/dashboard";
  const { data, loading, refreshing, error, refresh } = useApi(path);

  return {
    dashboard: data,
    kpis: data?.kpis || {},
    sparks: data?.sparks || {},
    monthly: data?.monthly || [],
    salesByProduct: data?.salesByProduct || [],
    dailyProduction: data?.dailyProduction || [],
    activeOrders: data?.activeOrders || [],
    expensesByCategory: data?.expensesByCategory || [],
    loading,
    refreshing,
    error,
    refresh,
  };
}

export default useDashboard;
