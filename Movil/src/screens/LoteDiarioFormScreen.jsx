import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useDailyBatches } from "../hooks/useDailyBatches";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import DateField from "../components/ui/DateField";
import FormField from "../components/ui/FormField";
import LoadingState from "../components/ui/LoadingState";
import ProductSelect from "../components/ui/ProductSelect";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue } from "../lib/format";
import { COLORS, previewDailyBatchNumber } from "../lib/batchFlow";

const MAX_TARGET = 9999999;
// Solo dígitos y hasta 7 (9 999 999).
const onlyDigits = (v) => v.replace(/\D/g, "").slice(0, 7);

// Mismos mensajes que el backend (dailyBatchesController) y la web
// (useDailyBatchForm). Devuelve el mensaje del error, o null si la meta es válida.
function targetError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Escribe la meta del lote (unidades).";
  const n = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(n) || n < 1 || n > MAX_TARGET) return "La meta debe ser un número entero entre 1 y 9 999 999.";
  return null;
}

// Crear o editar un lote diario, con los mismos campos que
// DailyBatchFormModal/useDailyBatchForm de la web. El ID lo genera el backend
// (acá solo se muestra la vista previa). La Meta es obligatoria y pasa al lote
// de fabricación al programarlo.
export default function LoteDiarioFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { dailyBatches, loading, crear, actualizar, eliminar } = useDailyBatches();
  const [form, setForm] = useState(isEditing ? null : { date: todayInput(), product: "", color: "Rojo", targetQuantity: "" });
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
        targetQuantity: daily.targetQuantity != null ? String(daily.targetQuantity) : "",
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
    const invalidTarget = targetError(form.targetQuantity);
    if (invalidTarget) {
      Alert.alert("Revisa la meta", invalidTarget);
      return;
    }
    setSaving(true);
    const payload = { ...form, date: form.date || undefined, targetQuantity: Number(form.targetQuantity) };
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
        <FormField
          label="Meta (unidades)"
          value={form.targetQuantity}
          onChangeText={(v) => handleChange("targetQuantity", onlyDigits(v))}
          keyboardType="number-pad"
          placeholder="Ej. 5000"
          suffix="u"
          required
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
