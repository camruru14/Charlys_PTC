import { useMemo } from "react";
import { defaultTransactionFilters, transactionFilterOptions } from "../../lib/transactionFilters";
import { FilterSelect } from "../ui/Field";
import SearchInput from "../ui/SearchInput";
import Button from "../ui/Button";
import { filterSelectClass, numberFilterClass } from "../../lib/filterStyles";

/*
  Barra de búsqueda + filtros para las transacciones.
  Props: list, filters, setFilters, compact
*/
function TransactionToolbar({ list = [], filters, setFilters, compact = false }) {
  const options = useMemo(() => transactionFilterOptions(list), [list]);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const hasActive =
    filters.q || filters.type || filters.category || filters.status ||
    filters.minAmount !== "" || filters.maxAmount !== "";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchInput value={filters.q} onChange={(v) => set("q", v)} placeholder="Buscar concepto, referencia, categoría…" className="w-full sm:w-[260px]" />

      <FilterSelect
        value={filters.type}
        onChange={(e) => set("type", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Tipo: todos" }, ...options.types.map((t) => ({ value: t, label: t }))]}
      />

      <FilterSelect
        value={filters.category}
        onChange={(e) => set("category", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Categoría: todas" }, ...options.categories.map((c) => ({ value: c, label: c }))]}
      />

      <FilterSelect
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Estado: todos" }, ...options.statuses.map((s) => ({ value: s, label: s }))]}
      />

      {!compact ? (
        <>
          <input type="number" value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} placeholder="Monto ≥" className={numberFilterClass} />
          <input type="number" value={filters.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} placeholder="Monto ≤" className={numberFilterClass} />
        </>
      ) : null}

      {hasActive ? (
        <Button variant="secondary" size="modal" onClick={() => setFilters(defaultTransactionFilters)}>
          Limpiar
        </Button>
      ) : null}
    </div>
  );
}

export default TransactionToolbar;
