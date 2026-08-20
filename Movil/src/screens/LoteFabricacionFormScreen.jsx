import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useBatches } from "../hooks/useBatches";
import { useEmployees } from "../hooks/useEmployees";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import DateField from "../components/ui/DateField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue } from "../lib/format";

const STATUSES = ["Programado", "En Proceso", "Completado", "Detenido"];

const emptyForm = {
  product: "",
  color: "",
  productionLine: "",
  producedQuantity: "",
  targetQuantity: "",
  status: "Programado",
  operator: "",
  startDate: todayInput(),
  endDate: "",
};

// Crear/editar un lote de fabricación. El número de lote lo genera el
// backend solo (no es un campo del formulario); en edición se agrega
// `endDate`, que no aparece al crear.
export default function LoteFabricacionFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { batches, loading: batchesLoading, crear, actualizar, eliminar } = useBatches();
  const { employees } = useEmployees();
  // Solo empleados de Fabricación pueden ser "operario responsable", mismo
  // criterio que useBatchForm.js del panel web.
  const operators = employees.filter((e) => e.department === "Fabricación");

  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const batch = batches.find((b) => b._id === id);
    if (batch) {
      setForm({
        product: batch.product || "",
        color: batch.color || "",
        productionLine: batch.productionLine || "",
        producedQuantity: batch.producedQuantity != null ? String(batch.producedQuantity) : "",
        targetQuantity: batch.targetQuantity != null ? String(batch.targetQuantity) : "",
        status: batch.status || "Programado",
        operator: batch.operator?._id || batch.operator || "",
        startDate: toDateInputValue(batch.startDate) || todayInput(),
        endDate: toDateInputValue(batch.endDate),
      });
      setLoaded(true);
      return;
    }
    // No apareció en la lista (ej. ya lo eliminaron desde otra pantalla):
    // en vez de dejar el spinner de carga para siempre, se avisa y se vuelve.
    if (!batchesLoading) {
      Alert.alert("No se encontró el lote", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, batches, batchesLoading, navigation]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.product.trim()) {
      Alert.alert("Falta información", "El producto es obligatorio");
      return;
    }
    setSaving(true);
    const payload = {
      product: form.product.trim(),
      color: form.color.trim() || undefined,
      productionLine: form.productionLine.trim() || undefined,
      producedQuantity: Number(form.producedQuantity) || 0,
      targetQuantity: form.targetQuantity === "" ? undefined : Number(form.targetQuantity),
      status: form.status,
      operator: form.operator || undefined,
      startDate: form.startDate || undefined,
    };
    try {
      if (isEditing) {
        await actualizar(id, { ...payload, endDate: form.endDate || undefined });
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
    title: isEditing ? "Editar lote" : "Nuevo lote",
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
      <FormField label="Producto" value={form.product} onChangeText={(v) => handleChange("product", v)} required />
      <FormField label="Color" value={form.color} onChangeText={(v) => handleChange("color", v)} />
      <FormField
        label="Línea de producción"
        value={form.productionLine}
        onChangeText={(v) => handleChange("productionLine", v)}
        placeholder="Ej. Línea 1"
      />
      <FormField
        label="Cantidad producida"
        value={form.producedQuantity}
        onChangeText={(v) => handleChange("producedQuantity", v)}
        keyboardType="numeric"
      />
      <FormField
        label="Cantidad objetivo"
        value={form.targetQuantity}
        onChangeText={(v) => handleChange("targetQuantity", v)}
        keyboardType="numeric"
      />
      <SegmentedField label="Estado" value={form.status} options={STATUSES} onChange={(v) => handleChange("status", v)} />
      <SegmentedField
        label="Operario responsable"
        value={form.operator}
        options={[{ id: "", label: "Sin asignar" }, ...operators.map((o) => ({ id: o._id, label: `${o.name} ${o.lastName}` }))]}
        getLabel={(o) => o.label}
        getValue={(o) => o.id}
        onChange={(v) => handleChange("operator", v)}
      />
      <DateField label="Fecha de inicio" value={form.startDate} onChange={(v) => handleChange("startDate", v)} />
      {isEditing ? (
        <DateField label="Fecha de fin" value={form.endDate} onChange={(v) => handleChange("endDate", v)} />
      ) : null}

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar el lote ${form.product}? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          disabled={deleting}
          label={deleting ? "Eliminando…" : "Eliminar"}
        />
      ) : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
});
