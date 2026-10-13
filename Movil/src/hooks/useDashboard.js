import { useApi } from "./useApi";

// GET /dashboard/mobile (private/backend): resumen de KPIs, alertas, mezcla de
// producción y lotes recientes para DashboardScreen. `range` (Fase 11)
// agrega los query params from/to — el filtrado real lo hace el backend;
// "Todo" (sin range) sigue pegándole a /dashboard/mobile tal cual.
// (/dashboard, sin «mobile», es ahora el resumen ejecutivo del Dashboard web.)
export function useDashboard(range) {
  const path =
    range?.from && range?.to
      ? `/dashboard/mobile?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      : "/dashboard/mobile";
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
