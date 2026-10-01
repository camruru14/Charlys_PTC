import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useInventory } from "../hooks/useInventory";
import { useWarehouses } from "../hooks/useWarehouses";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";
import LoadingState from "../components/ui/LoadingState";
import ProductSelect from "../components/ui/ProductSelect";
import SegmentedField from "../components/ui/SegmentedField";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { MATERIAL_TYPES, UNITS, unitShort } from "../lib/inventoryOptions";

const onlyDecimal = (v) => v.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

// Editar un artículo de inventario, con los mismos campos que el modal de
// Web/private/frontend/src/pages/Inventario.jsx según su categoría:
//   - Producto terminado: Artículo, Tipo (texto libre), Existencia, Unidad,
//     Bodega y Costo unitario.
//   - Materia prima: Artículo, Tipo (de material), Existencia, Unidad y Bodega.
// Lo que no aplica a la categoría no se envía, así no se pisa un valor que
// ya tuviera. Crear un artículo nuevo se hace desde la hoja «Nuevo artículo»
// de InventarioScreen.
export default function InventarioItemFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const toast = useToast();
  const { items, loading: itemsLoading, actualizar, eliminar } = useInventory();
  const { warehouses } = useWarehouses();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const item = items.find((i) => i._id === id);
  const isFinished = form?.category === "Producto Terminado";

  useEffect(() => {
    if (form) return;
    if (item) {
      setForm({
        name: item.name || "",
        category: item.category || "Materia Prima",
        type: item.type || "",
        unit: item.unit || "kg",
        stock: item.stock != null ? String(item.stock) : "",
        unitCost: item.unitCost != null ? String(item.unitCost) : "",
        location: item.location || "",
        materialType: item.materialType || MATERIAL_TYPES[0],
        color: item.color || "",
      });
      return;
    }
    if (!itemsLoading) {
      Alert.alert("No se encontró el artículo", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [form, item, itemsLoading, navigation]);

  useLayoutEffect(() => {
    if (!form) return;
    navigation.setOptions({
      title: isFinished ? "Editar producto terminado" : "Editar materia prima",
      headerSubtitle: [form.name, form.color].filter(Boolean).join(" · ") || undefined,
    });
  }, [navigation, form, isFinished]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Falta información", isFinished ? "Elige la categoría y el producto" : "El artículo es obligatorio");
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
    const payload = {
      name: form.name,
      category: form.category,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      location: form.location,
    };
    if (isFinished) {
      payload.unitCost = Number(form.unitCost) || 0;
      payload.type = form.type.trim();
    } else {
      payload.materialType = form.materialType;
    }
    try {
      await actualizar(id, payload);
      toast.show("Artículo actualizado");
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const label = `${form.name}${form.color ? ` · ${form.color}` : ""}`;
    Alert.alert("Eliminar artículo", `¿Eliminar ${label}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await eliminar(id);
            toast.show("Artículo eliminado");
            navigation.goBack();
          } catch (error) {
            setDeleting(false);
            Alert.alert("No se pudo eliminar", error.message || "Intenta de nuevo");
          }
        },
      },
    ]);
  };

  if (!form) return <LoadingState />;

  // La bodega guardada puede no estar entre las configuradas (se renombró o
  // se borró): se agrega a las opciones para no perderla al editar.
  const warehouseNames = warehouses.map((w) => w.name);
  if (form.location && !warehouseNames.includes(form.location)) warehouseNames.unshift(form.location);

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        {isFinished ? (
          <ProductSelect value={form.name} onChange={(v) => handleChange("name", v)} />
        ) : (
          <FormField label="Artículo" value={form.name} onChangeText={(v) => handleChange("name", v)} required />
        )}
        {isFinished ? (
          <FormField
            label="Tipo"
            value={form.type}
            onChangeText={(v) => handleChange("type", v)}
            placeholder="Ej. Normal, Jumbo, 60 mm"
          />
        ) : (
          <SelectField
            label="Tipo"
            title="Tipo de material"
            value={form.materialType}
            options={MATERIAL_TYPES.map((t) => ({ label: t, value: t }))}
            onChange={(v) => handleChange("materialType", v)}
            required
          />
        )}
        <FormField
          label="Existencia"
          value={form.stock}
          onChangeText={(v) => handleChange("stock", onlyDecimal(v))}
          keyboardType="decimal-pad"
          suffix={unitShort(form.unit)}
          required
        />
        <SegmentedField label="Unidad" value={form.unit} options={UNITS} onChange={(v) => handleChange("unit", v)} />
        <SelectField
          label="Bodega"
          value={form.location}
          options={warehouseNames.map((w) => ({ label: w, value: w }))}
          onChange={(v) => handleChange("location", v)}
          required
        />
        {isFinished ? (
          <FormField
            label="Costo unitario"
            value={form.unitCost}
            onChangeText={(v) => handleChange("unitCost", onlyDecimal(v))}
            keyboardType="decimal-pad"
            suffix="$"
          />
        ) : null}

        <Button
          title={deleting ? "Eliminando…" : "Eliminar artículo"}
          variant="danger"
          icon="trash"
          disabled={deleting || saving}
          onPress={handleDelete}
          style={styles.delete}
        />
      </KeyboardScreen>

      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          { title: "Guardar", loading: saving, disabled: deleting, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  delete: { marginTop: 8 },
});
