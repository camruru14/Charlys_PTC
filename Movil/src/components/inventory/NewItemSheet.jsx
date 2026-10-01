import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import BottomSheet from "../ui/BottomSheet";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import SegmentedField from "../ui/SegmentedField";
import SelectField from "../ui/SelectField";
import { MATERIAL_TYPES, UNITS, unitShort } from "../../lib/inventoryOptions";

const onlyDecimal = (v) => v.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const emptyForm = (location) => ({
  name: "",
  materialType: MATERIAL_TYPES[0],
  stock: "",
  unit: "kg",
  location,
});

// «Nuevo artículo» de Inventario. Como en la web, solo existe para Materia
// prima: el producto terminado se llena solo al enviar un lote a bodega
// desde Fabricación. La unidad arranca en «kg» y la bodega en la primera.
export default function NewItemSheet({ visible, warehouses, onClose, onCreate }) {
  const [form, setForm] = useState(emptyForm(warehouses[0] || ""));
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre, arranca en blanco.
  useEffect(() => {
    if (visible) setForm(emptyForm(warehouses[0] || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Falta información", "El artículo es obligatorio");
      return;
    }
    if (form.stock === "") {
      Alert.alert("Falta información", "La existencia es obligatoria");
      return;
    }
    if (!form.location) {
      Alert.alert("Falta información", "Elige una bodega");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        name: form.name.trim(),
        category: "Materia Prima",
        stock: Number(form.stock) || 0,
        unit: form.unit,
        location: form.location,
        materialType: form.materialType,
      });
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={saving ? undefined : onClose}
      title="Nuevo artículo"
      subtitle="Materia prima · se guarda en la bodega elegida"
      footer={
        <View style={styles.actions}>
          <Button title="Cancelar" variant="secondary" disabled={saving} onPress={onClose} style={styles.action} />
          <Button title="Guardar" loading={saving} onPress={handleSave} style={styles.action} />
        </View>
      }
    >
      <FormField label="Artículo" value={form.name} onChangeText={(v) => set("name", v)} required />
      <SelectField
        label="Tipo"
        title="Tipo de material"
        value={form.materialType}
        options={MATERIAL_TYPES.map((t) => ({ label: t, value: t }))}
        onChange={(v) => set("materialType", v)}
        required
      />
      <FormField
        label="Existencia"
        value={form.stock}
        onChangeText={(v) => set("stock", onlyDecimal(v))}
        keyboardType="decimal-pad"
        suffix={unitShort(form.unit)}
        required
      />
      <SegmentedField label="Unidad" value={form.unit} options={UNITS} onChange={(v) => set("unit", v)} />
      <SelectField
        label="Bodega"
        value={form.location}
        options={warehouses.map((w) => ({ label: w, value: w }))}
        onChange={(v) => set("location", v)}
        placeholder="Sin bodegas configuradas"
        required
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
