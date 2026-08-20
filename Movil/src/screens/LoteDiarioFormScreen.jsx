import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useDailyBatches } from "../hooks/useDailyBatches";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import DateField from "../components/ui/DateField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue } from "../lib/format";

const emptyForm = { date: todayInput(), product: "", color: "" };

// Crear/editar un lote diario (programación previa de un lote de
// fabricación). El dailyBatchNumber lo genera el backend solo.
export default function LoteDiarioFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { dailyBatches, loading: dailyLoading, crear, actualizar, eliminar } = useDailyBatches();

  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const batch = dailyBatches.find((b) => b._id === id);
    if (batch) {
      setForm({
        date: toDateInputValue(batch.date) || todayInput(),
        product: batch.product || "",
        color: batch.color || "",
      });
      setLoaded(true);
      return;
    }
    if (!dailyLoading) {
      Alert.alert("No se encontró el lote diario", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, dailyBatches, dailyLoading, navigation]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.product.trim()) {
      Alert.alert("Falta información", "El producto es obligatorio");
      return;
    }
    setSaving(true);
    const payload = {
      date: form.date || undefined,
      product: form.product.trim(),
      color: form.color.trim() || undefined,
    };
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
    title: isEditing ? "Editar lote diario" : "Nuevo lote diario",
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
      <DateField label="Fecha" value={form.date} onChange={(v) => handleChange("date", v)} required />
      <FormField label="Producto" value={form.product} onChangeText={(v) => handleChange("product", v)} required />
      <FormField label="Color" value={form.color} onChangeText={(v) => handleChange("color", v)} />

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar el lote diario ${form.product}? Esta acción no se puede deshacer.`}
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
