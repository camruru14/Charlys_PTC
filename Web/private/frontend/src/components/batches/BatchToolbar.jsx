import { useMemo } from "react";
import { IconSearch } from "../../lib/icons";
import { defaultBatchFilters, batchFilterOptions } from "../../lib/batchFilters";
import { FilterSelect } from "../ui/Field";

function BatchToolbar({ list = [], filters, setFilters, compact = false }) {
  const options = useMemo(() => batchFilterOptions(list), [list]);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-brand-400";
  const numberClass =
    "w-32 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-brand-400";

  const hasActiveFilters =
    filters.q ||
    filters.product ||
    filters.line ||
    filters.status ||
    filters.operator ||
    filters.minProduced !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Búsqueda */}
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <IconSearch
          width={16}
          height={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Buscar lote, producto, línea, estado…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400"
        />
      </div>

      <FilterSelect
        value={filters.product}
        onChange={(e) => set("product", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Producto: todos" }, ...options.products.map((p) => ({ value: p, label: p }))]}
      />

      <FilterSelect
        value={filters.line}
        onChange={(e) => set("line", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Línea: todas" }, ...options.lines.map((l) => ({ value: l, label: l }))]}
      />

      <FilterSelect
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className={selectClass}
        options={[{ value: "", label: "Estado: todos" }, ...options.statuses.map((s) => ({ value: s, label: s }))]}
      />

      {!compact ? (
        <>
          <FilterSelect
            value={filters.operator}
            onChange={(e) => set("operator", e.target.value)}
            className={selectClass}
            options={[{ value: "", label: "Operario: todos" }, ...options.operators]}
          />

          <input
            type="number"
            value={filters.minProduced}
            onChange={(e) => set("minProduced", e.target.value)}
            placeholder="Producido ≥"
            className={numberClass}
          />
        </>
      ) : null}

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => setFilters(defaultBatchFilters)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}

export default BatchToolbar;
