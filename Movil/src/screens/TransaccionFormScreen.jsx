import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useTransactions } from "../hooks/useTransactions";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import BottomBar from "../components/ui/BottomBar";
import DateField from "../components/ui/DateField";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import LoadingState from "../components/ui/LoadingState";
import Segmented from "../components/ui/Segmented";
import SegmentedField from "../components/ui/SegmentedField";
import { FieldLabel, fieldStyles } from "../components/ui/fieldStyles";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { todayInput, toDateInputValue } from "../lib/format";
import { PAYMENT_METHODS, invoiceError } from "../lib/finance";
import { categoryIconName, categoryTone } from "../lib/expenseCategories";
import { isStoreSale } from "../lib/transactionFilters";
import { pickPhotoSource } from "../lib/pickImages";

const TYPE_OPTIONS = [
  { value: "Gasto", label: "− Gasto" },
  { value: "Ingreso", label: "+ Otro ingreso" },
];

const emptyForm = (category = "") => ({
  concept: "",
  type: "Gasto",
  category,
  amount: "",
  status: "Completado",
  method: "Efectivo",
  dueDate: "",
  date: todayInput(),
});

// Monto con decimales, sin signo: solo dígitos y un punto.
function cleanAmount(v) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [int, ...rest] = s.split(".");
  return rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
}

const isPdf = (a) => a?.mimeType === "application/pdf" || /\.pdf$/i.test(a?.name || a?.url || "");

// Registrar o editar un movimiento manual (QuickEntry y TransactionModal de
// la web): tipo, monto grande, concepto, categoría en cuadrícula de íconos
// (solo gastos, solo las no archivadas), método, estado (con «Vence» si queda
// por pagar), fecha y la foto de la factura. Al guardar: POST o PUT del
// movimiento y después la factura (POST /attachment si hay una foto nueva,
// DELETE si se quitó). Las ventas de la tienda no se editan.
export default function TransaccionFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { transactions, loading, crear, actualizar, subirFactura, quitarFactura } = useTransactions();
  const { categories } = useExpenseCategories();

  const [form, setForm] = useState(isEditing ? null : emptyForm());
  const [newFile, setNewFile] = useState(null); // foto elegida y todavía sin subir
  const [removeExisting, setRemoveExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const transaction = isEditing ? transactions.find((t) => t._id === id) : null;
  const isExpense = form?.type === "Gasto";

  useEffect(() => {
    if (!isEditing || form) return;
    if (transaction) {
      if (isStoreSale(transaction)) {
        Alert.alert("Las ventas de la tienda no se editan", "Entran solas desde la tienda y no se pueden cambiar desde la app.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setForm({
        concept: transaction.concept || "",
        type: transaction.type || "Gasto",
        category: transaction.type === "Gasto" ? transaction.category || "" : "",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        status: transaction.status || "Completado",
        method: transaction.paymentMethod || "Efectivo",
        dueDate: toDateInputValue(transaction.dueDate),
        date: toDateInputValue(transaction.date) || todayInput(),
      });
      return;
    }
    if (!loading) {
      Alert.alert("No se encontró el movimiento", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, transaction, loading, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar movimiento" : isExpense === false ? "Nuevo ingreso" : "Nuevo gasto",
      headerBackTitle: "Finanzas",
    });
  }, [navigation, isEditing, isExpense]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // ¿Se puede elegir esa categoría en un Gasto? Las activas y, al editar, la que ya tenía el gasto.
  const validCategory = (name) =>
    categories.some((c) => c.name === name && (!c.archived || c.name === transaction?.category)) ||
    (transaction?.type === "Gasto" && name === transaction.category);

  // Al cambiar el tipo, una categoría que no es elegible para Gasto (la de un Ingreso) se limpia.
  const changeType = (type) =>
    setForm((f) => ({ ...f, type, category: type === "Gasto" && validCategory(f.category) ? f.category : "" }));

  const addPhoto = async () => {
    const file = (await pickPhotoSource(1))?.[0];
    if (!file) return;
    const error = invoiceError(file);
    if (error) {
      Alert.alert("No se puede adjuntar", error);
      return;
    }
    setNewFile({ uri: file.uri, name: file.name, type: file.type });
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    const problem = !(amount > 0)
      ? "Escribe un monto mayor que 0"
      : !form.concept.trim()
        ? "Escribe el concepto"
        : isExpense && !form.category
          ? "Elige la categoría del gasto"
          : isExpense && !validCategory(form.category)
            ? "Elige una categoría válida para el gasto"
            : null;
    if (problem) {
      Alert.alert("Falta información", problem);
      return;
    }

    setSaving(true);
    const pending = form.status === "Pendiente";
    const payload = {
      concept: form.concept.trim(),
      type: form.type,
      amount,
      status: form.status,
      date: form.date || undefined,
      paymentMethod: form.method,
      ...(isExpense ? { category: form.category } : {}),
      ...(isEditing ? { dueDate: pending && form.dueDate ? form.dueDate : null } : pending && form.dueDate ? { dueDate: form.dueDate } : {}),
    };
    try {
      let savedId = id;
      let reference;
      if (isEditing) {
        await actualizar(id, payload);
      } else {
        const res = await crear(payload);
        savedId = res?._id;
        reference = res?.reference;
      }

      // La factura va después: si falla, el movimiento ya quedó guardado.
      let invoiceProblem = null;
      try {
        if (newFile) await subirFactura(savedId, newFile);
        else if (isEditing && removeExisting && transaction?.attachment) await quitarFactura(savedId);
      } catch (err) {
        invoiceProblem = err.message;
      }

      toast.show(isEditing ? "Movimiento actualizado" : `${isExpense ? "Gasto" : "Ingreso"} ${reference || ""} registrado`.replace("  ", " "));
      if (invoiceProblem) Alert.alert("La factura no se pudo subir", `${invoiceProblem}. El movimiento quedó guardado.`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <LoadingState />;

  // Categorías no archivadas; al editar, la que ya tiene el gasto aunque esté archivada.
  const options = categories.filter((c) => !c.archived || c.name === form.category);
  if (form.category && !options.some((c) => c.name === form.category)) options.push({ _id: "legacy", name: form.category, icon: "tag", color: "gray" });

  const existing = isEditing && !removeExisting ? transaction?.attachment : null;

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <Segmented options={TYPE_OPTIONS} value={form.type} onChange={changeType} style={styles.type} />

        <View style={styles.amountBox}>
          <Text style={styles.currency}>$</Text>
          <TextInput
            style={styles.amount}
            value={form.amount}
            onChangeText={(v) => set("amount", cleanAmount(v))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.faint}
            selectTextOnFocus
            accessibilityLabel="Monto"
          />
        </View>

        <FormField
          value={form.concept}
          onChangeText={(v) => set("concept", v)}
          placeholder="¿En qué? Ej. combustible del camión"
          accessibilityLabel="Concepto"
        />

        {isExpense ? (
          <View style={fieldStyles.field}>
            <FieldLabel label="Categoría" required />
            {options.length ? (
              <View style={styles.grid}>
                {options.map((c) => {
                  const tone = categoryTone(c.color);
                  const selected = form.category === c.name;
                  return (
                    <Pressable
                      key={c._id}
                      onPress={() => set("category", selected ? "" : c.name)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={c.archived ? `${c.name} (archivada)` : c.name}
                      style={styles.cell}
                    >
                      <View style={[styles.cellIcon, selected ? { backgroundColor: tone.bg, borderColor: tone.dot } : null]}>
                        <Icon name={categoryIconName(c.icon)} size={20} color={selected ? tone.text : colors.muted} />
                      </View>
                      <Text style={[styles.cellText, selected && { fontFamily: fonts.semibold, color: tone.text }]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.hint}>Aún no hay categorías: créalas en Configuración › Categorías de gasto.</Text>
            )}
          </View>
        ) : (
          <Text style={[styles.hint, styles.incomeHint]}>Se registra como «Otros ingresos».</Text>
        )}

        <SegmentedField label="Método de pago" value={form.method} options={PAYMENT_METHODS} onChange={(v) => set("method", v)} />
        <SegmentedField
          label="Estado"
          value={form.status}
          options={[
            { value: "Completado", label: "Pagado" },
            { value: "Pendiente", label: isExpense ? "Por pagar" : "Por cobrar" },
          ]}
          onChange={(v) => set("status", v)}
        />
        {form.status === "Pendiente" ? <DateField label="Vence" value={form.dueDate} onChange={(v) => set("dueDate", v)} /> : null}
        <DateField label="Fecha" value={form.date} onChange={(v) => set("date", v)} maximumDate={new Date()} />

        <View style={fieldStyles.field}>
          <FieldLabel label="Foto de la factura" />
          {newFile ? (
            <View style={styles.invoice}>
              <Image source={{ uri: newFile.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
              <View style={styles.invoiceTexts}>
                <Text style={styles.invoiceName} numberOfLines={1}>
                  {newFile.name}
                </Text>
                <View style={styles.invoiceActions}>
                  <Pressable onPress={addPhoto} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.link}>Cambiar</Text>
                  </Pressable>
                  <Pressable onPress={() => setNewFile(null)} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.link, { color: tones.rose.text }]}>Quitar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : existing ? (
            <View style={styles.invoice}>
              {isPdf(existing) ? (
                <View style={[styles.thumb, styles.pdfThumb]}>
                  <Icon name="doc" size={26} color={colors.muted} />
                </View>
              ) : (
                <Image source={{ uri: existing.url }} style={styles.thumb} accessibilityIgnoresInvertColors />
              )}
              <View style={styles.invoiceTexts}>
                <Text style={styles.invoiceName} numberOfLines={1}>
                  {existing.name || "Factura"}
                </Text>
                <View style={styles.invoiceActions}>
                  <Pressable
                    onPress={() => Linking.openURL(existing.url).catch(() => Alert.alert("No se pudo abrir la factura", existing.url))}
                    hitSlop={8}
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>Ver</Text>
                  </Pressable>
                  <Pressable onPress={addPhoto} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.link}>Reemplazar</Text>
                  </Pressable>
                  <Pressable onPress={() => setRemoveExisting(true)} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.link, { color: tones.rose.text }]}>Quitar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable onPress={addPhoto} accessibilityRole="button" style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.surface2 }]}>
              <Icon name="camera" size={20} color={colors.primary} />
              <Text style={styles.addText}>Tomar foto o elegir de la galería</Text>
            </Pressable>
          )}
        </View>
      </KeyboardScreen>

      <BottomBar actions={[{ title: isEditing ? "Guardar" : isExpense ? "Guardar gasto" : "Guardar ingreso", loading: saving, onPress: handleSave }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  type: { marginBottom: 14 },
  amountBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 8 },
  currency: { fontFamily: fonts.bold, fontSize: 28, color: colors.muted },
  amount: {
    minWidth: 120,
    paddingVertical: 4,
    textAlign: "center",
    fontFamily: fonts.extrabold,
    fontSize: 42,
    letterSpacing: -0.8,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  cell: { width: "20%", alignItems: "center", paddingHorizontal: 3, marginBottom: 10, gap: 4 },
  cellIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.muted, textAlign: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  incomeHint: { marginBottom: 16 },
  invoice: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.canvas },
  pdfThumb: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  invoiceTexts: { flex: 1, gap: 6 },
  invoiceName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  invoiceActions: { flexDirection: "row", gap: 16 },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.primary },
  add: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
