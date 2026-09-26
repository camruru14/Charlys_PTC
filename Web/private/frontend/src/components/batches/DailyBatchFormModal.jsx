import Modal from "../ui/Modal";
import { Field, SelectField, ReadonlyField } from "../ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { PRODUCTS, COLORS } from "../../lib/batchFlow";

/*
  Modal de creación/edición de un lote diario (Producción diaria).
  Al «programar» un lote diario, sus datos pasan a Lotes de fabricación.
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
          <button onClick={onClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
          <button type="submit" form="daily-batch-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="daily-batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadonlyField label="ID de lote diario" value={form.dailyBatchNumber} />
        </div>
        <Field label="Fecha" name="date" type="date" value={form.date} onChange={handleChange} required />
        <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
        <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
      </form>
    </Modal>
  );
}

export default DailyBatchFormModal;
