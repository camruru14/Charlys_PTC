import Modal from "../ui/Modal";
import { Field, SelectField } from "../ui/Field";
import { todayInput } from "../../hooks/useBatchForm";

const PRODUCTS = ["Pajilla", "Pelota"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];
const LINES = ["Línea 1", "Línea 2", "Línea 3", "Línea 4"];
const STATUSES = ["Programado", "En Proceso", "Completado", "Detenido"];

/*
  Modal de creación/edición de un lote de fabricación.
  Reutilizado por la página de Fabricación y por el "Ver todo" editable de Fabricación.
*/
function BatchFormModal({ open, onClose, editingId, form, handleChange, handleSubmit, saving, operators }) {
  const target = Number(form.targetQuantity) || 0;
  const wastePct = target > 0 ? Math.round((Number(form.wasteQuantity) || 0) / target * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? "Editar lote" : "Nuevo lote de fabricación"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" form="batch-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* N° de lote autogenerado (solo lectura) */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Número de lote</span>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-slate-800">{form.batchNumber}</span>
          </div>
        </div>
        <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
        <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
        <SelectField label="Línea de producción" name="productionLine" value={form.productionLine} onChange={handleChange} options={LINES} />
        <Field label="Fecha" name="startDate" type="date" value={form.startDate} onChange={handleChange} max={todayInput()} />
        <Field label="Cantidad meta" name="targetQuantity" type="number" value={form.targetQuantity} onChange={handleChange} required />
        <Field label="Cantidad producida" name="producedQuantity" type="number" value={form.producedQuantity} onChange={handleChange} />
        {/* Residuos = Cantidad meta - Cantidad producida (se calcula solo) */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Residuos</span>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-slate-800">{form.wasteQuantity || 0}</span>
            <span className="text-xs text-slate-400">{wastePct}%</span>
          </div>
        </div>
        <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
        <SelectField
          label="Operario responsable"
          name="operator"
          value={form.operator}
          onChange={handleChange}
          placeholder="Sin asignar"
          options={operators.map((o) => ({ value: o._id, label: `${o.name} ${o.lastName}` }))}
        />
      </form>
    </Modal>
  );
}

export default BatchFormModal;
