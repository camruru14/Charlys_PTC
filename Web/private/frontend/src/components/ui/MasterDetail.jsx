/*
  Maestro-detalle: lista de ancho fijo a la izquierda y detalle flexible.
  Ambos paneles son tarjetas que ocupan el alto disponible con scroll interno.
  El registro seleccionado debe vivir en la URL (?id=), con useUrlState("id").

    <MasterDetail>
      <ListPanel header={<SearchInput … />}>
        <ListRow selected={…} onClick={…}>…</ListRow>
      </ListPanel>
      <DetailPanel header={…}>…</DetailPanel>
    </MasterDetail>
*/

export function MasterDetail({ listWidth = 360, className = "", children }) {
  return (
    <div
      className={`grid min-h-[520px] grid-cols-1 gap-4 lg:h-[calc(100dvh-190px)] lg:grid-cols-[var(--md-list)_minmax(0,1fr)] ${className}`}
      style={{ "--md-list": `${listWidth}px` }}
    >
      {children}
    </div>
  );
}

export function ListPanel({ header, footer, children }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {header ? <div className="flex flex-col gap-2.5 border-b border-line-soft p-3">{header}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="border-t border-line-soft bg-surface-2 px-4 py-2.5">{footer}</div> : null}
    </section>
  );
}

export function DetailPanel({ header, footer, children }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      {header ? <div className="border-b border-line-soft bg-surface-2 px-5 py-4">{header}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      {footer ? <div className="border-t border-line-soft bg-surface-2 px-5 py-3">{footer}</div> : null}
    </section>
  );
}

// Fila de la lista maestro: grid 5px 1fr, con barra izquierda al seleccionarse.
export function ListRow({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      className={`grid w-full grid-cols-[5px_1fr] border-b border-line-soft text-left transition ${
        selected ? "bg-select-bg" : "hover:bg-surface-2"
      }`}
    >
      <span className={selected ? "bg-select-bar" : ""} />
      <span className="min-w-0 px-3.5 py-3">{children}</span>
    </button>
  );
}

export default MasterDetail;
