import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useTransactions } from "../hooks/useTransactions";
import BottomBar from "../components/ui/BottomBar";
import Card from "../components/ui/Card";
import DateField from "../components/ui/DateField";
import FormField from "../components/ui/FormField";
import LoadingState from "../components/ui/LoadingState";
import SegmentedField from "../components/ui/SegmentedField";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { todayInput, toDateInputValue } from "../lib/format";
import { CATEGORIES, STATUSES, TYPES, previewReference } from "../lib/finance";

const emptyForm = {
  reference: "",
  concept: "",
  type: "Ingreso",
  category: "Ventas",
  amount: "",
  status: "Completado",
  date: "",
};

// Monto con decimales, sin signo: solo dígitos y un punto.
function cleanAmount(v) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [int, ...rest] = s.split(".");
  return rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
}

// Crear o editar una transacción, con los mismos campos, categorías y
// payload que el modal de Finanzas.jsx en la web. El N° definitivo lo genera
// el backend al guardar (acá solo se muestra la vista previa). Eliminar está
// en la lista de Finanzas (mantener presionada la fila), como el menú «…» de
// la web.
export default function TransaccionFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { transactions, loading, crear, actualizar } = useTransactions();

  const [form, setForm] = useState(isEditing ? null : { ...emptyForm, date: todayInput() });
  const [saving, setSaving] = useState(false);

  const transaction = isEditing ? transactions.find((t) => t._id === id) : null;

  useEffect(() => {
    if (!isEditing || form) return;
    if (transaction) {
      setForm({
        reference: transaction.reference || "",
        concept: transaction.concept || "",
        type: transaction.type || "Ingreso",
        category: transaction.category || "Ventas",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        status: transaction.status || "Completado",
        date: toDateInputValue(transaction.date),
      });
      return;
    }
    if (!loading) {
      Alert.alert("No se encontró la transacción", "Puede que ya haya sido eliminada.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, transaction, loading, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar transacción" : "Nueva transacción",
      headerBackTitle: "Finanzas",
    });
  }, [navigation, isEditing]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.concept.trim()) {
      Alert.alert("Falta información", "Escribe el concepto");
      return;
    }
    if (form.amount === "") {
      Alert.alert("Falta información", "Escribe el monto");
      return;
    }
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) || 0, date: form.date || undefined };
    try {
      if (isEditing) {
        await actualizar(id, payload);
        toast.show("Transacción actualizada");
      } else {
        const res = await crear(payload);
        toast.show(res?.reference ? `Transacción ${res.reference} registrada` : "Transacción registrada");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <LoadingState />;

  // Una categoría antigua que ya no está en la lista se conserva.
  const categories = CATEGORIES.includes(form.category) || !form.category ? CATEGORIES : [...CATEGORIES, form.category];
  const reference = isEditing ? form.reference : previewReference(transactions);

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <Card style={styles.referenceCard}>
          <Text style={type.overline}>N° de transacción</Text>
          <Text style={styles.reference}>{reference || "—"}</Text>
          {!isEditing ? <Text style={styles.referenceNote}>Se asigna solo al guardar</Text> : null}
        </Card>

        <FormField label="Concepto" value={form.concept} onChangeText={(v) => handleChange("concept", v)} required />
        <SegmentedField label="Tipo" value={form.type} options={TYPES} onChange={(v) => handleChange("type", v)} required />
        <View style={styles.columns}>
          <SelectField
            label="Categoría"
            value={form.category}
            options={categories.map((c) => ({ label: c, value: c }))}
            onChange={(v) => handleChange("category", v)}
            style={styles.column}
          />
          <FormField
            label="Monto ($)"
            value={form.amount}
            onChangeText={(v) => handleChange("amount", cleanAmount(v))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            required
            style={styles.column}
          />
        </View>
        <SegmentedField label="Estado" value={form.status} options={STATUSES} onChange={(v) => handleChange("status", v)} />
        <DateField label="Fecha" value={form.date} onChange={(v) => handleChange("date", v)} />
      </KeyboardScreen>

      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          { title: "Guardar", loading: saving, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  referenceCard: { gap: 3, marginBottom: 16 },
  reference: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ["tabular-nums"] },
  referenceNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
});
