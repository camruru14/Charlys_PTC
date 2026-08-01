/*
  Utilidades de búsqueda y filtrado para los lotes de fabricación.
  Se usan tanto en la card del Dashboard como en la página Historial de Lotes.
*/

export const defaultBatchFilters = {
  q: "", // texto: num de lote, producto, línea, estado
  product: "", // filtro exacto por producto
  line: "", // filtro exacto por línea
  status: "", // filtro exacto por estado
  operator: "", // filtro exacto por operario responsable (id)
  minProduced: "", // cantidad producida mínima
  maxWaste: "", // porcentaje de residuos máximo
};

// Opciones únicas presentes en la lista (para los desplegables de filtro).
export function batchFilterOptions(list = []) {
  const uniq = (key) =>
    [...new Set(list.map((b) => b[key]).filter(Boolean))].sort();

  const operatorMap = new Map();
  for (const b of list) {
    if (b.operator?._id) {
      operatorMap.set(b.operator._id, `${b.operator.name} ${b.operator.lastName}`);
    }
  }
  const operators = [...operatorMap.entries()]
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    products: uniq("product"),
    lines: uniq("productionLine"),
    statuses: uniq("status"),
    operators,
  };
}

/*
  Filtra la lista de lotes según los filtros y (opcionalmente) un rango de fechas.
  @param range { from: Date, to: Date } — filtra por createdAt del lote.
*/
export function filterBatches(list = [], filters = defaultBatchFilters, range = null) {
  return list.filter((b) => {
    // Rango de fechas (usa la fecha de producción; respaldo: fecha de creación)
    if (range?.from && range?.to) {
      const c = new Date(b.startDate || b.createdAt);
      if (Number.isNaN(c.getTime()) || c < range.from || c > range.to) return false;
    }

    // Búsqueda de texto libre
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

    if (filters.minProduced !== "" && (b.producedQuantity || 0) < Number(filters.minProduced))
      return false;
    if (filters.maxWaste !== "" && (b.wastePercentage || 0) > Number(filters.maxWaste))
      return false;

    return true;
  });
}
