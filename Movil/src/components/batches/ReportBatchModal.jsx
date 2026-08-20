import { useEffect, useState } from "react";
import FormModal from "../ui/FormModal";
import FormField from "../ui/FormField";
import SegmentedField from "../ui/SegmentedField";

// Formulario chico de "Reportar producción" (Fase 4): cantidad producida
// (precargada con `producedQuantity`, editable) + bodega de destino. Al
// confirmar, esto también deja el lote como "En Proceso" si estaba
// "Programado" y lo agrega/actualiza en Inventario > Lotes Reportados — todo
// eso lo hace el backend, acá solo se manda `{ producedQuantity, warehouse }`.
export default function ReportBatchModal({ visible, batch, warehouses, saving, onClose, onSave }) {
  const [producedQuantity, setProducedQuantity] = useState("");
  const [warehouse, setWarehouse] = useState("");

  useEffect(() => {
    if (!visible || !batch) return;
    setProducedQuantity(batch.producedQuantity != null ? String(batch.producedQuantity) : "");
    setWarehouse(warehouses[0]?.name || "");
  }, [visible, batch, warehouses]);

  return (
    <FormModal
      visible={visible}
      title={batch ? `Reportar ${batch.batchNumber}` : "Reportar"}
      onClose={onClose}
      onSave={() => onSave({ producedQuantity: Number(producedQuantity) || 0, warehouse })}
      saving={saving}
      canSave={Boolean(warehouse)}
      saveLabel="Reportar"
    >
      <FormField
        label="Cantidad producida"
        value={producedQuantity}
        onChangeText={setProducedQuantity}
        keyboardType="numeric"
        required
      />
      <SegmentedField
        label="Bodega"
        value={warehouse}
        options={warehouses}
        getLabel={(w) => w.name}
        getValue={(w) => w.name}
        onChange={setWarehouse}
      />
    </FormModal>
  );
}
