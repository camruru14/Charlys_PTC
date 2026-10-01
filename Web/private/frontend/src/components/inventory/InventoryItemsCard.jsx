import ActionsMenu from "../ui/ActionsMenu";
import EmptyState from "../ui/EmptyState";
import Pagination from "../ui/Pagination";
import { usePagedRows } from "../../hooks/usePagedRows";
import { IconEdit, IconAlert } from "../../lib/icons";

/*
  Tarjeta de artículos de inventario (Producto terminado y Materia prima):
  indicadores (kpis, opcional), barra de filtros, tabla en grid y pie con
  resumen o paginación.
    columns = [{ key, label, width, align, className, render(item) }]
    rows    = TODOS los artículos que pasan los filtros: la tarjeta pagina
              (usePagedRows, como las listas de Configuración: llega hasta el
              margen inferior y muestra las filas que caben)
    resetKey = cambia con los filtros: vuelve a la primera página
  La última columna (Acción: editar + «…») la agrega la tarjeta.
*/

// Clases del <FilterSelect> de la barra de filtros (34px).
export const filterSelectClass =
  "h-[34px] min-w-[132px] rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2";

// Chip conmutable rosa «Solo bajo mínimo · N».
export function LowStockToggle({ active, count, onToggle }) {
  if (!active && count === 0) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 text-[11.5px] font-semibold tabular-nums transition ${
        active ? "bg-primary text-white" : "bg-tone-rose text-tone-rose-text hover:brightness-95"
      }`}
    >
      <IconAlert width={13} height={13} />
      Solo bajo mínimo · {count}
    </button>
  );
}

function InventoryItemsCard({
  kpis,
  filterBar,
  columns,
  rows,
  loading,
  error,
  emptyText,
  rowClassName,
  onEdit,
  onDelete,
  summary,
  noun = "artículos",
  resetKey = "",
}) {
  const { cardRef, areaRef, cardStyle, visible, page, setPage, size, total, paged } = usePagedRows(rows, { rowHeight: 46, headerHeight: 32, resetKey });
  const template = [...columns.map((c) => c.width), "92px"].join(" ");
  const gridStyle = { gridTemplateColumns: template };

  let body;
  if (loading) body = <EmptyState title="Cargando artículos…" />;
  else if (error) body = <EmptyState title="No se pudo cargar el inventario" description={error} />;
  else if (rows.length === 0) body = <EmptyState title={emptyText} />;
  else {
    body = visible.map((item) => (
      <div
        key={item._id}
        style={gridStyle}
        className={`grid min-h-[46px] items-center border-b border-line-soft last:border-0 ${rowClassName?.(item) || ""}`}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            className={`min-w-0 px-3 py-1.5 first:pl-[18px] ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className || ""}`}
          >
            {c.render(item)}
          </div>
        ))}
        <div className="flex items-center justify-end gap-0.5 pr-3">
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Editar ${item.name}`}
            title="Editar"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconEdit width={15} height={15} />
          </button>
          <ActionsMenu size="row" items={[{ label: "Eliminar artículo", onClick: () => onDelete(item), danger: true }]} />
        </div>
      </div>
    ));
  }

  return (
    <section ref={cardRef} style={cardStyle} className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {/* Cabecera: indicadores arriba a la izquierda (opcional) y debajo los filtros. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-line-soft px-[18px] py-[13px]">
        {kpis}
        <div className="flex flex-wrap items-center gap-2">{filterBar}</div>
      </div>
      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[1080px]">
          <div style={gridStyle} className="grid h-8 items-center border-b border-line-soft bg-surface-2">
            {columns.map((c) => (
              <div
                key={c.key}
                className={`t-label px-3 first:pl-[18px] ${c.align === "right" ? "text-right" : ""} ${c.headerClassName || ""}`}
              >
                {c.label}
              </div>
            ))}
            <div className="t-label pr-[18px] text-right">Acción</div>
          </div>
          {body}
        </div>
      </div>
      {paged ? (
        <Pagination page={page} size={size} total={total} noun={noun} onChange={setPage} />
      ) : (
        <div className="flex h-[38px] shrink-0 items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-[18px]">
          <p className="t-aux tabular-nums">{summary}</p>
        </div>
      )}
    </section>
  );
}

export default InventoryItemsCard;
