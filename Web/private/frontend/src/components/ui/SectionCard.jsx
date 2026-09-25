/* Tarjeta de sección (radio 14px, borde line) con encabezado y acción opcional. */
export function SectionCard({ title, action, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-[14px] border border-line bg-surface ${className}`}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="t-card-title">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={`px-5 pb-5 ${title || action ? "" : "pt-5"}`}>{children}</div>
    </section>
  );
}

/*
  Muestra el estado de una carga asíncrona.
  Envuelve el contenido y solo lo renderiza cuando hay datos.
*/
export function AsyncState({ loading, error, empty, emptyText = "Sin registros.", children }) {
  if (loading) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-surface-2 p-8 text-center text-[13px] font-medium text-muted">
        Cargando…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-[12px] border border-tone-rose-dot/30 bg-tone-rose p-6 text-[13px] font-medium text-tone-rose-text">
        {error}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-surface-2 p-8 text-center text-[13px] font-medium text-muted">
        {emptyText}
      </div>
    );
  }
  return children;
}

export default SectionCard;
