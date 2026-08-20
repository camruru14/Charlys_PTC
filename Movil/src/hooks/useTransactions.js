import { useApi } from "./useApi";

// GET /transactions (private/backend): ingresos y gastos.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
export function useTransactions() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/transactions");

  return {
    transactions: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useTransactions;
