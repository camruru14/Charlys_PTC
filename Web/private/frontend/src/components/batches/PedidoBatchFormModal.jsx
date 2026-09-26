import Modal from "../ui/Modal";
import { Field, SelectField, ReadonlyField } from "../ui/Field";
import { todayInput } from "../../hooks/useBatchForm";
import { blockNegativeKey } from "../../lib/numberInput";
import { buttonClass } from "../../lib/buttonStyles";
import { fmtNumber } from "../../lib/format";
import { PRODUCTS, COLORS, PRODUCTION_LINES, BATCH_STATUSES } from "../../lib/batchFlow";

/*
  Modal de edición de un lote de «Fabricación de pedidos» (categoría «Pedido»).
  Mismos campos que BatchFormModal, más «Meta» de solo lectura: la cantidad
  pedida que originó el lote (form.targetQuantity).
*/
function PedidoBatchFormModal({ open, onClose, editingId, form, handleChange, handleSubmit, saving, operators }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? "Editar lote" : "Nuevo lote de fabricación"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
          <button type="submit" form="pedido-batch-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="pedido-batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadonlyField label="Número de lote" value={form.batchNumber} />
        </div>
        <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
        <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
        <SelectField label="Línea de producción" name="productionLine" value={form.productionLine} onChange={handleChange} options={PRODUCTION_LINES} />
        <Field label="Fecha" name="startDate" type="date" value={form.startDate} onChange={handleChange} max={todayInput()} />
        <ReadonlyField label="Meta" value={form.targetQuantity !== "" && form.targetQuantity != null ? fmtNumber(form.targetQuantity) : "Sin meta"} />
        <Field label="Cantidad producida" name="producedQuantity" type="number" min="0" onKeyDown={blockNegativeKey} value={form.producedQuantity} onChange={handleChange} />
        <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={BATCH_STATUSES} />
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

export default PedidoBatchFormModal;
