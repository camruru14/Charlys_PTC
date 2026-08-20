/* Tarjeta de sección con encabezado y acción opcional. */
export function SectionCard({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="px-5 pb-5">{children}</div>
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
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm font-medium text-slate-500">
        Cargando…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm font-medium text-slate-500">
        {emptyText}
      </div>
    );
  }
  return children;
}

export default SectionCard;
