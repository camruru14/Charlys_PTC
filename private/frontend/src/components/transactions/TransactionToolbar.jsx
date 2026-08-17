import { useMemo } from "react";
import { IconSearch } from "../../lib/icons";
import { defaultTransactionFilters, transactionFilterOptions } from "../../lib/transactionFilters";
import { FilterSelect } from "../ui/Field";

/*
  Barra de búsqueda + filtros para las transacciones.
  Props: list, filters, setFilters, compact
*/
function TransactionToolbar({ list = [], filters, setFilters, compact = false }) {
  const options = useMemo(() => transactionFilterOptions(list), [list]);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-brand-400";
  const numberClass =
    "w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-brand-400";

  const hasActive =
    filters.q || filters.type || filters.category || filters.status ||
    filters.minAmount !== "" || filters.maxAmount !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Buscar concepto, referencia, categoría…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400"
        />
      </div>

      <FilterSelect
        value={filters.type}
        onChange={(e) => set("type", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Tipo: todos" }, ...options.types.map((t) => ({ value: t, label: t }))]}
      />

      <FilterSelect
        value={filters.category}
        onChange={(e) => set("category", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Categoría: todas" }, ...options.categories.map((c) => ({ value: c, label: c }))]}
      />

      <FilterSelect
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Estado: todos" }, ...options.statuses.map((s) => ({ value: s, label: s }))]}
      />

      {!compact ? (
        <>
          <input type="number" value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} placeholder="Monto ≥" className={numberClass} />
          <input type="number" value={filters.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} placeholder="Monto ≤" className={numberClass} />
        </>
      ) : null}

      {hasActive ? (
        <button
          type="button"
          onClick={() => setFilters(defaultTransactionFilters)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}

export default TransactionToolbar;
