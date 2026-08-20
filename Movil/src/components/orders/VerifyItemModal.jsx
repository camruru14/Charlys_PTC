import { useEffect, useState } from "react";
import FormModal from "../ui/FormModal";
import SegmentedField from "../ui/SegmentedField";

// Formulario chico de "Verificar" un producto del pedido (Fase 4): elegir la
// bodega de donde se descuenta el stock. Si no hay stock suficiente ahí, el
// backend devuelve 404/400 con un mensaje — PedidoDetalleScreen lo muestra
// tal cual con Alert.alert.
export default function VerifyItemModal({ visible, item, warehouses, saving, onClose, onSave }) {
  const [warehouse, setWarehouse] = useState("");

  useEffect(() => {
    if (!visible) return;
    setWarehouse(warehouses[0]?.name || "");
  }, [visible, warehouses]);

  return (
    <FormModal
      visible={visible}
      title={item ? `Verificar ${item.product}${item.color ? ` · ${item.color}` : ""}` : "Verificar"}
      onClose={onClose}
      onSave={() => onSave(warehouse)}
      saving={saving}
      canSave={Boolean(warehouse)}
      saveLabel="Verificar"
    >
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
