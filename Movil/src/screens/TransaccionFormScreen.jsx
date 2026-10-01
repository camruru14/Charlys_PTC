import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useTransactions } from "../hooks/useTransactions";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import DateField from "../components/ui/DateField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue } from "../lib/format";

const TYPES = ["Ingreso", "Gasto"];
const STATUSES = ["Pendiente", "Completado"];

const emptyForm = {
  concept: "",
  type: "Ingreso",
  category: "",
  amount: "",
  status: "Completado",
  date: todayInput(),
};

// Crear/editar una transacción financiera. El `reference` (TRAN-2026-000X)
// lo genera el backend solo.
export default function TransaccionFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { transactions, loading: transactionsLoading, crear, actualizar, eliminar } = useTransactions();

  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const transaction = transactions.find((t) => t._id === id);
    if (transaction) {
      setForm({
        concept: transaction.concept || "",
        type: transaction.type || "Ingreso",
        category: transaction.category || "",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        status: transaction.status || "Completado",
        date: toDateInputValue(transaction.date) || todayInput(),
      });
      setLoaded(true);
      return;
    }
    if (!transactionsLoading) {
      Alert.alert("No se encontró la transacción", "Puede que ya haya sido eliminada.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, transactions, transactionsLoading, navigation]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.concept.trim()) {
      Alert.alert("Falta información", "El concepto es obligatorio");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      Alert.alert("Falta información", "El monto debe ser mayor a cero");
      return;
    }
    setSaving(true);
    const payload = {
      concept: form.concept.trim(),
      type: form.type,
      category: form.category.trim() || undefined,
      amount: Number(form.amount) || 0,
      status: form.status,
      date: form.date || undefined,
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
    title: isEditing ? "Editar transacción" : "Nueva transacción",
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
      <FormField label="Concepto" value={form.concept} onChangeText={(v) => handleChange("concept", v)} required />
      <SegmentedField label="Tipo" value={form.type} options={TYPES} onChange={(v) => handleChange("type", v)} />
      <FormField
        label="Categoría"
        value={form.category}
        onChangeText={(v) => handleChange("category", v)}
        placeholder="Ej. Materia Prima, Ventas…"
      />
      <FormField
        label="Monto ($)"
        value={form.amount}
        onChangeText={(v) => handleChange("amount", v)}
        keyboardType="numeric"
        required
      />
      <SegmentedField label="Estado" value={form.status} options={STATUSES} onChange={(v) => handleChange("status", v)} />
      <DateField label="Fecha" value={form.date} onChange={(v) => handleChange("date", v)} />

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar la transacción ${form.concept}? Esta acción no se puede deshacer.`}
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
