import Modal from "../ui/Modal";
import { Field, SelectField, ReadonlyField } from "../ui/Field";
import { blockNegativeKey } from "../../lib/numberInput";
import { buttonClass } from "../../lib/buttonStyles";
import { PRODUCTS, COLORS, PRODUCTION_LINES, BATCH_STATUSES } from "../../lib/batchFlow";

/*
  Modal de creación/edición de un lote de fabricación de stock (Lotes de
  fabricación). Reutilizado por Fabricación y por el «Ver todo» editable.
  Los lotes de pedido (categoría «Pedido») avanzan desde Fabricación > Pedidos
  con acciones directas, sin formulario.
*/
function BatchFormModal({ open, onClose, editingId, form, handleChange, handleSubmit, saving, operators }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? "Editar lote" : "Nuevo lote de fabricación"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
          <button type="submit" form="batch-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadonlyField label="Número de lote" value={form.batchNumber} />
        </div>
        <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
        <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
        <SelectField label="Línea de producción" name="productionLine" value={form.productionLine} onChange={handleChange} options={PRODUCTION_LINES} />
        <Field label="Meta (unidades)" name="targetQuantity" type="number" min="0" onKeyDown={blockNegativeKey} value={form.targetQuantity} onChange={handleChange} />
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

export default BatchFormModal;
