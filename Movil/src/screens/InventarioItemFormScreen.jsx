import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useInventory } from "../hooks/useInventory";
import { useWarehouses } from "../hooks/useWarehouses";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { UNITS, MATERIAL_TYPES } from "../lib/inventoryStatus";

// Crear/editar un artículo de "Artículos en almacén" (Materia Prima o
// Producto Terminado; los lotes reportados nunca se crean/editan a mano,
// solo nacen de "Reportar" en Fabricación). La categoría no es un campo del
// formulario — la determina desde qué sub-sección se tocó "+" (igual que el
// web, donde "Agregar" vive en cada sección y la categoría nunca se elige a
// mano en el modal).
export default function InventarioItemFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const category = route.params?.category || "Materia Prima";

  const { items, loading: itemsLoading, crear, actualizar, eliminar } = useInventory();
  const { warehouses } = useWarehouses();

  const [form, setForm] = useState({
    name: "",
    unit: "kg",
    stock: "",
    unitCost: "",
    location: "",
    materialType: MATERIAL_TYPES[0],
  });
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const item = items.find((i) => i._id === id);
    if (item) {
      setForm({
        name: item.name || "",
        unit: item.unit || "kg",
        stock: item.stock != null ? String(item.stock) : "",
        unitCost: item.unitCost != null ? String(item.unitCost) : "",
        location: item.location || "",
        materialType: item.materialType || MATERIAL_TYPES[0],
      });
      setLoaded(true);
      return;
    }
    if (!itemsLoading) {
      Alert.alert("No se encontró el artículo", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, items, itemsLoading, navigation]);

  // Precarga la primera bodega disponible al crear, apenas cargan.
  useEffect(() => {
    if (isEditing || form.location) return;
    if (warehouses.length > 0) setForm((f) => ({ ...f, location: warehouses[0].name }));
  }, [isEditing, warehouses, form.location]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Falta información", "El artículo es obligatorio");
      return;
    }
    if (!form.location) {
      Alert.alert("Falta información", "Elegí una bodega");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      location: form.location,
    };
    if (category === "Producto Terminado") {
      payload.unitCost = Number(form.unitCost) || 0;
    } else {
      payload.materialType = form.materialType;
    }
    try {
      if (isEditing) {
        await actualizar(id, payload);
      } else {
        await crear(payload);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  useSaveCancelHeader({
    navigation,
    title: isEditing ? "Editar artículo" : `Agregar ${category === "Producto Terminado" ? "producto terminado" : "materia prima"}`,
    saving,
    onSave: handleSave,
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eliminar(id);
      navigation.goBack();
    } catch (error) {
      setDeleting(false);
      Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
    }
  };

  if (isEditing && !loaded) return <LoadingState />;

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <FormField label="Artículo" value={form.name} onChangeText={(v) => handleChange("name", v)} required />
      <FormField
        label="Existencia"
        value={form.stock}
        onChangeText={(v) => handleChange("stock", v)}
        keyboardType="numeric"
        required
      />
      <SegmentedField label="Unidad" value={form.unit} options={UNITS} onChange={(v) => handleChange("unit", v)} />
      <SegmentedField
        label="Bodega"
        value={form.location}
        options={warehouses}
        getLabel={(w) => w.name}
        getValue={(w) => w.name}
        onChange={(v) => handleChange("location", v)}
      />
      {category === "Producto Terminado" ? (
        <FormField
          label="Costo unitario ($)"
          value={form.unitCost}
          onChangeText={(v) => handleChange("unitCost", v)}
          keyboardType="numeric"
        />
      ) : (
        <SegmentedField
          label="Tipo"
          value={form.materialType}
          options={MATERIAL_TYPES}
          onChange={(v) => handleChange("materialType", v)}
        />
      )}

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar ${form.name}? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          disabled={deleting}
          label={deleting ? "Eliminando…" : "Eliminar"}
        />
      ) : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
});
