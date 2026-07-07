import StatusPill from "../ui/StatusPill";

/*
  Tabla (solo lectura) del historial de lotes.
  Reutilizada por la card del Dashboard y por la página Historial de Lotes.
*/
function BatchTable({ batches = [] }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm font-medium text-slate-500">
        No se encontraron lotes con esos criterios.
      </div>
    );
  }

  const fmt = (v) => Number(v || 0).toLocaleString("es-SV");
  const fmtDate = (b) => {
    const d = new Date(b.startDate || b.createdAt);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-3 pr-4 font-semibold">Lote</th>
            <th className="pb-3 pr-4 font-semibold">Fecha</th>
            <th className="pb-3 pr-4 font-semibold">Producto</th>
            <th className="pb-3 pr-4 font-semibold">Línea</th>
            <th className="pb-3 pr-4 font-semibold">Producido</th>
            <th className="pb-3 pr-4 font-semibold">Residuos</th>
            <th className="pb-3 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {batches.map((b) => (
            <tr key={b._id} className="text-slate-600 transition hover:bg-slate-50/60">
              <td className="py-3 pr-4 font-semibold text-slate-800">{b.batchNumber}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(b)}</td>
              <td className="py-3 pr-4">{b.product}{b.color ? ` · ${b.color}` : ""}</td>
              <td className="py-3 pr-4">{b.productionLine || "—"}</td>
              <td className="py-3 pr-4 tabular-nums">{fmt(b.producedQuantity)}</td>
              <td className="py-3 pr-4 tabular-nums">{b.wastePercentage ?? 0}%</td>
              <td className="py-3"><StatusPill status={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BatchTable;
