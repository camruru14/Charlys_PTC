/*
  Tarjeta de una gráfica del Dashboard: título, subtítulo y acción arriba; abajo, el cuerpo que
  llena el alto disponible (`flex-1 min-h-0`, para que la gráfica se mida y no haya scroll). Maneja
  los estados de carga, error y vacío («Sin datos en este rango»).
*/
function ChartCard({ title, subtitle, action, loading = false, error = null, empty = false, emptyText = "Sin datos en este rango", className = "", children }) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface ${className}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <h2 className="t-card-title">{title}</h2>
          {subtitle ? <p className="t-aux mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex min-h-[150px] min-w-0 flex-1 flex-col px-5 pb-4 xl:min-h-0">
        {loading ? (
          <p className="m-auto text-[13px] font-medium text-muted">Cargando…</p>
        ) : error ? (
          <p className="m-auto text-center text-[13px] font-medium text-tone-rose-text">{error}</p>
        ) : empty ? (
          <p className="m-auto text-[13px] text-subtle">{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default ChartCard;
