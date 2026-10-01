import { usePagedRows } from "../../hooks/usePagedRows";
import Pagination from "./Pagination";
import { AsyncState } from "./SectionCard";

/*
  Tarjeta de sección con una tabla paginada (Finanzas, Historial de
  transacciones, Historial de lotes). Misma técnica que las listas de
  Configuración: en lg la tarjeta llega hasta el margen inferior de la página y
  muestra las filas que caben; si no caben todas, aparece el pie «1–8 de 23».
    <PagedSection title="…" action={…} toolbar={…} items={filtrados} resetKey={filtros}
                  rowHeight={42} noun="transacciones" loading={…} error={…}>
      {(rows) => <TransactionTable transactions={rows} />}
    </PagedSection>
  La tabla trae su propio encabezado de columnas (headerHeight, 32px).
*/
function PagedSection({ title, subtitle, action, toolbar, items, rowHeight, headerHeight = 32, resetKey = "", noun, loading, error, children }) {
  const { cardRef, areaRef, cardStyle, visible, page, setPage, size, total, paged } = usePagedRows(items, { rowHeight, headerHeight, resetKey });
  return (
    <section ref={cardRef} style={cardStyle} className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {title || action ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h2 className="t-card-title">{title}</h2>
            {subtitle ? <p className="t-aux mt-0.5">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {toolbar ? <div className="shrink-0 px-5 pb-1">{toolbar}</div> : null}
      <div ref={areaRef} className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft">
        <AsyncState loading={loading} error={error}>
          {children(visible)}
        </AsyncState>
      </div>
      {paged ? (
        <Pagination page={page} size={size} total={total} noun={noun} onChange={setPage} />
      ) : null}
    </section>
  );
}

export default PagedSection;
