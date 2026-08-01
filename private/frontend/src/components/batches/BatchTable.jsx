import StatusPill from "../ui/StatusPill";

/*
  Tabla del historial de lotes.
  Reutilizada por la card del Dashboard (solo lectura) y por las páginas
  de historial. Si se pasan onEdit/onDelete, se muestra una columna de acciones.
*/
function BatchTable({ batches = [], showOperator = false, onEdit, onDelete }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm font-medium text-slate-500">
        No se encontraron lotes con esos criterios.
      </div>
    );
  }

  const showActions = Boolean(onEdit || onDelete);

  const fmt = (v) => Number(v || 0).toLocaleString("es-SV");
  // startDate se guarda como medianoche UTC del día elegido (fecha sin hora),
  // así que se lee en UTC para no correrla un día en husos detrás de UTC.
  // createdAt sí es un instante real, por eso ese se lee en la zona local.
  const fmtDate = (b) => {
    const raw = b.startDate || b.createdAt;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    if (b.startDate) opts.timeZone = "UTC";
    return d.toLocaleDateString("es-SV", opts);
  };
  const fmtOperator = (b) =>
    b.operator ? `${b.operator.name} ${b.operator.lastName}` : "—";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-3 pr-4 font-semibold">Lote</th>
            <th className="pb-3 pr-4 font-semibold">Fecha</th>
            <th className="pb-3 pr-4 font-semibold">Producto</th>
            <th className="pb-3 pr-4 font-semibold">Color</th>
            <th className="pb-3 pr-4 font-semibold">Línea</th>
            <th className="pb-3 pr-4 font-semibold">Meta</th>
            <th className="pb-3 pr-4 font-semibold">Producido</th>
            <th className="pb-3 pr-4 font-semibold">Residuos</th>
            <th className="pb-3 pr-4 font-semibold">Estado</th>
            {showOperator ? <th className="pb-3 pr-4 font-semibold">Operario</th> : null}
            {showActions ? <th className="pb-3 font-semibold text-right">Acciones</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {batches.map((b) => (
            <tr key={b._id} className="text-slate-600 transition hover:bg-slate-50/60">
              <td className="py-3 pr-4 font-semibold text-slate-800">{b.batchNumber}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(b)}</td>
              <td className="py-3 pr-4">{b.product}</td>
              <td className="py-3 pr-4">{b.color || "—"}</td>
              <td className="py-3 pr-4">{b.productionLine || "—"}</td>
              <td className="py-3 pr-4 tabular-nums">{fmt(b.targetQuantity)}</td>
              <td className="py-3 pr-4 tabular-nums">{fmt(b.producedQuantity)}</td>
              <td className="py-3 pr-4 tabular-nums">{Math.round(b.wastePercentage ?? 0)}%</td>
              <td className="py-3 pr-4"><StatusPill status={b.status} /></td>
              {showOperator ? <td className="py-3 pr-4">{fmtOperator(b)}</td> : null}
              {showActions ? (
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2 text-xs font-semibold">
                    {onEdit ? (
                      <button onClick={() => onEdit(b)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                    ) : null}
                    {onDelete ? (
                      <button onClick={() => onDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BatchTable;
