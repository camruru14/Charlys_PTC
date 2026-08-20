import { useApi } from "./useApi";

// GET /dashboard (private/backend): resumen de KPIs, alertas, mezcla de
// producción y lotes recientes para DashboardScreen. `range` (Fase 11)
// agrega los mismos query params from/to que ya usa
// Web/private/frontend/src/pages/Dashboard.jsx — el filtrado real lo hace
// el backend; "Todo" (sin range) sigue pegándole a /dashboard tal cual.
export function useDashboard(range) {
  const path =
    range?.from && range?.to
      ? `/dashboard?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      : "/dashboard";
  const { data, loading, refreshing, error, refresh } = useApi(path);

  return {
    dashboard: data,
    kpis: data?.kpis || {},
    recentBatches: data?.recentBatches || [],
    productionMix: data?.productionMix || [],
    alerts: data?.alerts || [],
    loading,
    refreshing,
    error,
    refresh,
  };
}

export default useDashboard;
