import { useMemo, useState } from "react";
import { useUrlState } from "./useUrlState";
import { isBelowMinimum } from "../lib/stockLevel";

/*
  Estado compartido de las tablas de Inventario (Producto terminado y
  Materia prima): filtros propios de cada tabla, el chip «Solo bajo mínimo»
  (que vive en la URL como ?bajoMinimo=1). La paginación la hace la tarjeta
  (InventoryItemsCard); `resetKey` cambia con cualquier filtro para que vuelva
  a la primera página.
    matches(item, filters) decide si un artículo pasa los filtros de la tabla.
*/
export function useInventoryTable(items, initialFilters, matches) {
  const [filters, setFilters] = useState(initialFilters);
  const [lowOnlyParam, setLowOnlyParam] = useUrlState("bajoMinimo");
  const lowOnly = lowOnlyParam === "1";

  const lowCount = useMemo(() => items.filter(isBelowMinimum).length, [items]);

  const filtered = useMemo(
    () => items.filter((i) => (!lowOnly || isBelowMinimum(i)) && matches(i, filters)),
    [items, lowOnly, filters, matches],
  );

  return {
    filters,
    setFilter: (key, value) => setFilters((f) => ({ ...f, [key]: value })),
    lowOnly,
    lowCount,
    toggleLowOnly: () => setLowOnlyParam(lowOnly ? null : "1"),
    filtered,
    resetKey: `${JSON.stringify(filters)}|${lowOnly}`,
  };
}

export default useInventoryTable;
