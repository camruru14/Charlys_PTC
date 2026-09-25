import { useMemo } from "react";
import InventoryItemsCard, { LowStockToggle, filterSelectClass } from "../../components/inventory/InventoryItemsCard";
import StockMeter from "../../components/ui/StockMeter";
import SearchInput from "../../components/ui/SearchInput";
import ColorSwatch from "../../components/ui/ColorSwatch";
import { FilterSelect } from "../../components/ui/Field";
import { useInventoryTable } from "../../hooks/useInventoryTable";
import { stockLevel, stockFillPercent, isRecentInbound, STOCK_LEVEL_TONE } from "../../lib/stockLevel";
import { fmtNumber, fmtRelativeDay } from "../../lib/format";
import { IconArrowUp } from "../../lib/icons";

const initialFilters = { search: "", location: "", color: "" };

function matches(item, { search, location, color }) {
  const q = search.trim().toLowerCase();
  if (q && !`${item.name || ""} ${item.color || ""}`.toLowerCase().includes(q)) return false;
  if (location && item.location !== location) return false;
  if (color && item.color !== color) return false;
  return true;
}

// «+3,050 de Fabricación · LOT-0416 · hoy»: último ingreso desde Fabricación
// (lastInbound), solo si llegó hoy o ayer.
function InboundLine({ inbound }) {
  const parts = [`+${fmtNumber(inbound.quantity)} de Fabricación`];
  if (inbound.batchNumber) parts.push(inbound.batchNumber);
  parts.push(fmtRelativeDay(inbound.at));
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold tabular-nums text-tone-green-text">
      <IconArrowUp width={11} height={11} strokeWidth={2.4} />
      {parts.join(" · ")}
    </p>
  );
}

const columns = [
  {
    key: "name",
    label: "Artículo",
    width: "minmax(0,1fr)",
    render: (i) => (
      <>
        <p className="truncate text-[13.5px] font-semibold text-ink">{i.name}</p>
        {isRecentInbound(i) ? <InboundLine inbound={i.lastInbound} /> : null}
      </>
    ),
  },
  {
    key: "color",
    label: "Color",
    width: "128px",
    render: (i) => (
      <span className="flex items-center gap-2 t-row">
        <ColorSwatch color={i.color} />
        <span className="truncate">{i.color || "—"}</span>
      </span>
    ),
  },
  { key: "type", label: "Tipo", width: "126px", render: (i) => <span className="t-row truncate">{i.type || "—"}</span> },
  {
    key: "stock",
    label: "Existencia",
    width: "112px",
    align: "right",
    render: (i) => <span className="text-[13.5px] font-semibold text-ink">{fmtNumber(i.stock)}</span>,
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

// Fondo de la fila: bajo mínimo (row-alert) tiene prioridad sobre ingreso reciente (row-new).
function rowClassName(item) {
  if (stockLevel(item) === "Bajo mínimo") return "bg-row-alert";
  if (isRecentInbound(item)) return "bg-row-new";
  return "";
}

function ProductoTerminado({ items, loading, error, onEdit, onDelete }) {
  const table = useInventoryTable(items, initialFilters, matches);
  const { filters, setFilter } = table;

  const locations = useMemo(() => Array.from(new Set(items.map((i) => i.location).filter(Boolean))).sort(), [items]);
  const colors = useMemo(() => Array.from(new Set(items.map((i) => i.color).filter(Boolean))).sort(), [items]);
  const units = table.filtered.reduce((s, i) => s + (Number(i.stock) || 0), 0);

  return (
    <InventoryItemsCard
      filterBar={
        <>
          <SearchInput
            value={filters.search}
            onChange={(v) => setFilter("search", v)}
            placeholder="Buscar artículo o color"
            className="w-[252px] [&_input]:h-[34px]"
          />
          <FilterSelect
            value={filters.location}
            onChange={(e) => setFilter("location", e.target.value)}
            className={filterSelectClass}
            options={[{ value: "", label: "Bodega: todas" }, ...locations.map((l) => ({ value: l, label: l }))]}
          />
          <FilterSelect
            value={filters.color}
            onChange={(e) => setFilter("color", e.target.value)}
            className={filterSelectClass}
            options={[{ value: "", label: "Color: todos" }, ...colors.map((c) => ({ value: c, label: c }))]}
          />
          <LowStockToggle active={table.lowOnly} count={table.lowCount} onToggle={table.toggleLowOnly} />
        </>
      }
      columns={columns}
      rows={table.pageRows}
      loading={loading}
      error={error}
      emptyText={items.length === 0 ? "No hay productos terminados en almacén." : "Ningún artículo coincide con los filtros."}
      rowClassName={rowClassName}
      onEdit={onEdit}
      onDelete={onDelete}
      summary={`${fmtNumber(table.filtered.length)} de ${fmtNumber(items.length)} artículos · ${fmtNumber(units)} unidades en total`}
      page={table.page}
      pageCount={table.pageCount}
      onPage={table.setPage}
    />
  );
}

export default ProductoTerminado;
