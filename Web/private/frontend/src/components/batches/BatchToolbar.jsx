import { useMemo } from "react";
import { defaultBatchFilters, batchFilterOptions } from "../../lib/batchFilters";
import { FilterSelect } from "../ui/Field";
import SearchInput from "../ui/SearchInput";
import Button from "../ui/Button";
import { filterSelectClass, numberFilterClass } from "../../lib/filterStyles";

function BatchToolbar({ list = [], filters, setFilters, compact = false }) {
  const options = useMemo(() => batchFilterOptions(list), [list]);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const hasActiveFilters =
    filters.q ||
    filters.product ||
    filters.line ||
    filters.status ||
    filters.operator ||
    filters.minProduced !== "";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchInput value={filters.q} onChange={(v) => set("q", v)} placeholder="Buscar lote, producto, línea, estado…" className="w-full sm:w-[260px]" />

      <FilterSelect
        value={filters.product}
        onChange={(e) => set("product", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Producto: todos" }, ...options.products.map((p) => ({ value: p, label: p }))]}
      />

      <FilterSelect
        value={filters.line}
        onChange={(e) => set("line", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Línea: todas" }, ...options.lines.map((l) => ({ value: l, label: l }))]}
      />

      <FilterSelect
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className={filterSelectClass}
        options={[{ value: "", label: "Estado: todos" }, ...options.statuses.map((s) => ({ value: s, label: s }))]}
      />

      {!compact ? (
        <>
          <FilterSelect
            value={filters.operator}
            onChange={(e) => set("operator", e.target.value)}
            className={filterSelectClass}
            options={[{ value: "", label: "Operario: todos" }, ...options.operators]}
          />

          <input
            type="number"
            value={filters.minProduced}
            onChange={(e) => set("minProduced", e.target.value)}
            placeholder="Producido ≥"
            className={numberFilterClass}
          />
        </>
      ) : null}

      {hasActiveFilters ? (
        <Button variant="secondary" size="modal" onClick={() => setFilters(defaultBatchFilters)}>
          Limpiar
        </Button>
      ) : null}
    </div>
  );
}

export default BatchToolbar;
