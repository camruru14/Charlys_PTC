// Utilidades de búsqueda y filtrado para lotes de fabricación, portadas de
// Web/private/frontend/src/lib/batchFilters.js. `operator`/`minProduced` se
// agregan acá (Fase 5) para la vista completa "Historial de lotes" — la
// card compacta del Dashboard (Fase 4) simplemente no los usa.
export const defaultBatchFilters = {
  q: "",
  product: "",
  line: "",
  status: "",
  operator: "",
  minProduced: "",
};

export function batchFilterOptions(list = []) {
  const uniq = (key) => [...new Set(list.map((b) => b[key]).filter(Boolean))].sort();

  const operatorMap = new Map();
  for (const b of list) {
    if (b.operator?._id) {
      operatorMap.set(b.operator._id, `${b.operator.name} ${b.operator.lastName}`);
    }
  }
  const operators = [...operatorMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    products: uniq("product"),
    lines: uniq("productionLine"),
    statuses: uniq("status"),
    operators,
  };
}

// range: { from: Date, to: Date } opcional — todavía no hay selector de
// rango de fechas en la app móvil, se deja listo para cuando se agregue.
export function filterBatches(list = [], filters = defaultBatchFilters, range = null) {
  return list.filter((b) => {
    if (range?.from && range?.to) {
      const c = new Date(b.startDate || b.createdAt);
      if (Number.isNaN(c.getTime()) || c < range.from || c > range.to) return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [b.batchNumber, b.product, b.productionLine, b.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.product && b.product !== filters.product) return false;
    if (filters.line && b.productionLine !== filters.line) return false;
    if (filters.status && b.status !== filters.status) return false;
    if (filters.operator && b.operator?._id !== filters.operator) return false;
    if (filters.minProduced !== "" && (b.producedQuantity || 0) < Number(filters.minProduced)) return false;
    return true;
  });
}

export default { defaultBatchFilters, batchFilterOptions, filterBatches };
