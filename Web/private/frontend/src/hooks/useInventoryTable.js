import { useMemo, useState } from "react";
import { useUrlState } from "./useUrlState";
import { PAGE_SIZE } from "../components/inventory/InventoryItemsCard";
import { isBelowMinimum } from "../lib/stockLevel";

/*
  Estado compartido de las tablas de Inventario (Producto terminado y
  Materia prima): filtros propios de cada tabla, el chip «Solo bajo mínimo»
  (que vive en la URL como ?bajoMinimo=1) y la página actual. Cualquier cambio
  de filtro vuelve a la página 1.
    matches(item, filters) decide si un artículo pasa los filtros de la tabla.
*/
export function useInventoryTable(items, initialFilters, matches) {
  const [filters, setFilters] = useState(initialFilters);
  const [lowOnlyParam, setLowOnlyParam] = useUrlState("bajoMinimo");
  const [page, setPage] = useState(1);
  const lowOnly = lowOnlyParam === "1";

  const lowCount = useMemo(() => items.filter(isBelowMinimum).length, [items]);

  const filtered = useMemo(
    () => items.filter((i) => (!lowOnly || isBelowMinimum(i)) && matches(i, filters)),
    [items, lowOnly, filters, matches],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return {
    filters,
    setFilter: (key, value) => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
    lowOnly,
    lowCount,
    toggleLowOnly: () => {
      setLowOnlyParam(lowOnly ? null : "1");
      setPage(1);
    },
    filtered,
    pageRows,
    page: currentPage,
    pageCount,
    setPage,
  };
}

export default useInventoryTable;
