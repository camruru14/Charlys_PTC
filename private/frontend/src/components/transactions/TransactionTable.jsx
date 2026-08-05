import StatusPill from "../ui/StatusPill";
import { txDate } from "../../lib/transactionFilters";

/*
  Tabla de transacciones con los campos: Fecha, Concepto, Categoría, Monto y Estado.
  Si se pasa onEdit y/u onDelete, muestra una columna de acciones para editar/eliminar.
*/
function TransactionTable({ transactions = [], onEdit, onDelete }) {
  const showActions = Boolean(onEdit || onDelete);
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm font-medium text-slate-500">
        No se encontraron transacciones con esos criterios.
      </div>
    );
  }

  // date se guarda como medianoche UTC del día elegido (fecha sin hora), así que
  // se lee en UTC para no correrla un día en husos detrás de UTC (p. ej. El Salvador).
  // createdAt sí es un instante real, por eso ese se lee en la zona local.
  const fmtDate = (t) => {
    const raw = txDate(t);
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    if (t.date) opts.timeZone = "UTC";
    return d.toLocaleDateString("es-SV", opts);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-3 pr-4 font-semibold">N° Transacción</th>
            <th className="pb-3 pr-4 font-semibold">Fecha</th>
            <th className="pb-3 pr-4 font-semibold">Concepto</th>
            <th className="pb-3 pr-4 font-semibold">Categoría</th>
            <th className="pb-3 pr-4 font-semibold">Monto</th>
            <th className="pb-3 pr-6 font-semibold">Estado</th>
            {showActions ? <th className="pb-3 font-semibold text-right">Acciones</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((t) => (
            <tr key={t._id} className="text-slate-600 transition hover:bg-slate-50/60">
              <td className="py-3 pr-4 whitespace-nowrap font-semibold text-slate-800">{t.reference}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(t)}</td>
              <td className="py-3 pr-4 font-medium text-slate-700">{t.concept}</td>
              <td className="py-3 pr-4">{t.category || "—"}</td>
              <td className={`py-3 pr-4 font-semibold tabular-nums ${t.type === "Ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                {t.type === "Ingreso" ? "+" : "-"}${Number(t.amount || 0).toFixed(2)}
              </td>
              <td className="py-3 pr-6"><StatusPill status={t.status} tone={t.status === "Pagado" ? "blue" : undefined} /></td>
              {showActions ? (
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {onEdit ? (
                      <button
                        onClick={() => onEdit(t)}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        onClick={() => onDelete(t)}
                        className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        Eliminar
                      </button>
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

export default TransactionTable;
