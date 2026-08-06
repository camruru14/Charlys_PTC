import Modal from "../ui/Modal";
import { SelectField } from "../ui/Field";
import { WAREHOUSES } from "../../hooks/useBatchForm";

/*
  Modal de confirmación para "Reportar" un lote desde Fabricación.
  Las unidades a reportar se calculan solas (lo que falta para llegar a la
  meta del lote) y no se piden a mano. Al confirmar, se suman al lote y,
  del lado del backend, se agrega/actualiza el artículo correspondiente en
  Inventario > Lotes Reportados (Artículo = producto, Categoría = Producto
  Terminado, Existencia = cantidad producida acumulada, Bodega = la elegida aquí).
*/
function ReportBatchModal({ open, onClose, target, form, handleChange, handleSubmit, saving }) {
  if (!target) return null;

  const toReport = Number(form.producedQuantity) || 0;
  const canReport = toReport > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reportar lote · ${target.batchNumber}`}
      footer={
        <>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !canReport} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? "Reportando…" : "Confirmar reporte"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
          Vas a reportar producción de <strong>{target.product}</strong>. Al confirmar, esta cantidad se sumará
          al lote y se agregará (o actualizará) como Producto Terminado en Inventario.
        </p>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Unidades a reportar</span>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-slate-800">{toReport.toLocaleString("es-SV")}</span>
            <span className="text-xs text-slate-400">Calculado automáticamente</span>
          </div>
          {!canReport ? (
            <p className="mt-1.5 text-xs text-amber-600">Este lote ya alcanzó su cantidad meta, no hay unidades pendientes por reportar.</p>
          ) : null}
        </div>
        <SelectField label="Bodega" name="warehouse" value={form.warehouse} onChange={handleChange} options={WAREHOUSES} required />
      </div>
    </Modal>
  );
}

export default ReportBatchModal;
