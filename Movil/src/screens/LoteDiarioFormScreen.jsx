import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useDailyBatches } from "../hooks/useDailyBatches";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import DateField from "../components/ui/DateField";
import LoadingState from "../components/ui/LoadingState";
import ProductSelect from "../components/ui/ProductSelect";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue } from "../lib/format";
import { COLORS, previewDailyBatchNumber } from "../lib/batchFlow";

// Crear o editar un lote diario, con los mismos campos que
// DailyBatchFormModal/useDailyBatchForm de la web. El ID lo genera el backend
// (acá solo se muestra la vista previa).
export default function LoteDiarioFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { dailyBatches, loading, crear, actualizar, eliminar } = useDailyBatches();
  const [form, setForm] = useState(isEditing ? null : { date: todayInput(), product: "", color: "Rojo" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const daily = isEditing ? dailyBatches.find((b) => b._id === id) : null;

  useEffect(() => {
    if (!isEditing || form) return;
    if (daily) {
      setForm({
        date: toDateInputValue(daily.date),
        product: daily.product || "",
        color: daily.color || "",
      });
      return;
    }
    if (!loading) {
      Alert.alert("No se encontró el lote diario", "Puede que ya se haya programado o eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, daily, loading, navigation]);

  const numberPreview = isEditing ? daily?.dailyBatchNumber : previewDailyBatchNumber(dailyBatches);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar lote diario" : "Nuevo lote diario",
      headerSubtitle: numberPreview || undefined,
    });
  }, [navigation, isEditing, numberPreview]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.date) {
      Alert.alert("Falta información", "La fecha es obligatoria");
      return;
    }
    if (!form.product) {
      Alert.alert("Falta información", "Elige la categoría y el producto");
      return;
    }
    setSaving(true);
    const payload = { ...form, date: form.date || undefined };
    try {
      if (isEditing) {
        await actualizar(id, payload);
        toast.show("Lote diario actualizado");
      } else {
        const res = await crear(payload);
        toast.show(res?.dailyBatchNumber ? `Lote ${res.dailyBatchNumber} creado` : "Lote diario creado");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Eliminar lote diario", `¿Eliminar el lote ${daily?.dailyBatchNumber || ""}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await eliminar(id);
            toast.show("Lote diario eliminado");
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

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <DateField label="Fecha" value={form.date} onChange={(v) => handleChange("date", v)} required />
        <ProductSelect value={form.product} onChange={(v) => handleChange("product", v)} />
        <SelectField
          label="Color"
          value={form.color}
          options={[{ label: "Sin color", value: "" }, ...COLORS.map((c) => ({ label: c, value: c }))]}
          onChange={(v) => handleChange("color", v)}
        />
        {isEditing ? (
          <Button
            title={deleting ? "Eliminando…" : "Eliminar lote diario"}
            variant="danger"
            icon="trash"
            disabled={deleting || saving}
            onPress={handleDelete}
            style={styles.delete}
          />
        ) : null}
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
