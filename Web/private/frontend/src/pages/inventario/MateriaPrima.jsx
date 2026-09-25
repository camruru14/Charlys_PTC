import InventoryItemsCard, { LowStockToggle, filterSelectClass } from "../../components/inventory/InventoryItemsCard";
import StockMeter from "../../components/ui/StockMeter";
import SearchInput from "../../components/ui/SearchInput";
import { FilterSelect } from "../../components/ui/Field";
import { useInventoryTable } from "../../hooks/useInventoryTable";
import { stockLevel, stockFillPercent, STOCK_LEVEL_TONE } from "../../lib/stockLevel";
import { fmtNumber } from "../../lib/format";
import { MATERIAL_TYPES } from "../../lib/inventoryOptions";

const initialFilters = { search: "", type: "" };

function matches(item, { search, type }) {
  const q = search.trim().toLowerCase();
  if (q && !(item.name || "").toLowerCase().includes(q)) return false;
  if (type && item.materialType !== type) return false;
  return true;
}

const columns = [
  {
    key: "name",
    label: "Artículo",
    width: "minmax(0,1fr)",
    render: (i) => <p className="truncate text-[13.5px] font-semibold text-ink">{i.name}</p>,
  },
  { key: "type", label: "Tipo", width: "126px", render: (i) => <span className="t-row truncate">{i.materialType || "—"}</span> },
  {
    key: "stock",
    label: "Existencia",
    width: "112px",
    align: "right",
    render: (i) => (
      <span className="text-[13.5px] font-semibold text-ink">
        {fmtNumber(i.stock)} {i.unit || ""}
      </span>
    ),
  },
  {
    key: "location",
    label: "Bodega",
    width: "168px",
    className: "!pl-[18px]",
    headerClassName: "!pl-[18px]",
    render: (i) => <span className="t-row truncate">{i.location || "—"}</span>,
  },
  {
    key: "level",
    label: "Nivel de stock",
    width: "244px",
    render: (i) => {
      const level = stockLevel(i);
      return <StockMeter percent={stockFillPercent(i)} tone={STOCK_LEVEL_TONE[level]} label={level} />;
    },
  },
];

function rowClassName(item) {
  return stockLevel(item) === "Bajo mínimo" ? "bg-row-alert" : "";
}

function MateriaPrima({ items, loading, error, onEdit, onDelete }) {
  const table = useInventoryTable(items, initialFilters, matches);
  const { filters, setFilter } = table;

  return (
    <InventoryItemsCard
      filterBar={
        <>
          <SearchInput
            value={filters.search}
            onChange={(v) => setFilter("search", v)}
            placeholder="Buscar artículo"
            className="w-[252px] [&_input]:h-[34px]"
          />
          <FilterSelect
            value={filters.type}
            onChange={(e) => setFilter("type", e.target.value)}
            className={filterSelectClass}
            options={[{ value: "", label: "Tipo: todos" }, ...MATERIAL_TYPES.map((t) => ({ value: t, label: t }))]}
          />
          <LowStockToggle active={table.lowOnly} count={table.lowCount} onToggle={table.toggleLowOnly} />
        </>
      }
      columns={columns}
      rows={table.pageRows}
      loading={loading}
      error={error}
      emptyText={items.length === 0 ? "No hay materia prima en almacén." : "Ningún artículo coincide con los filtros."}
      rowClassName={rowClassName}
      onEdit={onEdit}
      onDelete={onDelete}
      summary={`${fmtNumber(table.filtered.length)} de ${fmtNumber(items.length)} artículos`}
      page={table.page}
      pageCount={table.pageCount}
      onPage={table.setPage}
    />
  );
}

export default MateriaPrima;
