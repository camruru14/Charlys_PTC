import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// GET /expense-categories (private/backend): categorías de gasto de Finanzas,
// activas y archivadas, ordenadas por el backend. Con { usage: "2026-10" }
// cada una trae además usage { paid, pending, count, budget } de ese mes.
// crear / actualizar: POST y PUT /expense-categories/:id. No hay DELETE: se
// archivan con actualizar(id, { archived: true }).
// guardarPresupuestos(month, items): PUT /expense-categories/budgets con
// [{ id, amount }] (amount null quita el presupuesto desde ese mes); solo el
// mes actual o uno futuro.
export function useExpenseCategories({ usage } = {}) {
  const { data, loading, refreshing, error, refresh, crear, actualizar } = useApi(
    usage ? `/expense-categories?usage=${usage}` : "/expense-categories",
    { mutatePath: "/expense-categories" },
  );

  const guardarPresupuestos = useCallback(
    async (month, items) => {
      const result = await api.put("/expense-categories/budgets", { month, items });
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    categories: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    guardarPresupuestos,
  };
}

export default useExpenseCategories;
