import ActionsMenu from "../ui/ActionsMenu";
import EmptyState from "../ui/EmptyState";
import { IconEdit, IconAlert } from "../../lib/icons";

/*
  Tarjeta de artículos de inventario (Producto terminado y Materia prima):
  barra de filtros, tabla en grid, pie con resumen y paginación.
    columns = [{ key, label, width, align, className, render(item) }]
    rows    = artículos de la página actual (ya filtrados y paginados)
  La última columna (Acción: editar + «…») la agrega la tarjeta.
*/

export const PAGE_SIZE = 12;

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

export function Pagination({ page, pageCount, onPage }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const btn = "flex h-[26px] min-w-[26px] items-center justify-center rounded-[7px] px-1.5 text-[12px] font-semibold tabular-nums transition";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={`${btn} text-ink-2 hover:bg-surface disabled:opacity-40`}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={`${btn} ${p === page ? "bg-primary text-white" : "text-ink-2 hover:bg-surface"}`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Página siguiente"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className={`${btn} text-ink-2 hover:bg-surface disabled:opacity-40`}
      >
        ›
      </button>
    </div>
  );
}

function InventoryItemsCard({
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
  page,
  pageCount,
  onPage,
}) {
  const template = [...columns.map((c) => c.width), "92px"].join(" ");
  const gridStyle = { gridTemplateColumns: template };

  let body;
  if (loading) body = <EmptyState title="Cargando artículos…" />;
  else if (error) body = <EmptyState title="No se pudo cargar el inventario" description={error} />;
  else if (rows.length === 0) body = <EmptyState title={emptyText} />;
  else {
    body = rows.map((item) => (
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
    <section className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-[18px] py-[13px]">{filterBar}</div>
      <div className="overflow-x-auto">
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
      <div className="flex h-[38px] items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-[18px]">
        <p className="t-aux tabular-nums">{summary}</p>
<Pagination page={page} pageCount={Math.max(1, pageCount)} onPage={onPage} />
      </div>
    </section>
  );
}

export default InventoryItemsCard;
