import Modal from "../ui/Modal";
import { Field, SelectField } from "../ui/Field";

const PRODUCTS = ["Pajilla", "Pelota"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

/*
  Modal de creación/edición de un lote diario (fabricación).
  Al "programar" un lote diario, sus datos pasan a Lotes de fabricación.
*/
function DailyBatchFormModal({ open, onClose, editingId, form, handleChange, handleSubmit, saving }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? "Editar lote diario" : "Nuevo lote diario"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" form="daily-batch-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="daily-batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* ID autogenerado (solo lectura) */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">ID de lote diario</span>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-slate-800">{form.dailyBatchNumber}</span>
          </div>
        </div>
        <Field label="Fecha" name="date" type="date" value={form.date} onChange={handleChange} required />
        <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
        <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
      </form>
    </Modal>
  );
}

export default DailyBatchFormModal;
