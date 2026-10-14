import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useBatches } from "../hooks/useBatches";
import { useEmployees } from "../hooks/useEmployees";
import { useProductionLines, withCurrentLine } from "../hooks/useProductionLines";
import BottomBar from "../components/ui/BottomBar";
import FormField from "../components/ui/FormField";
import LoadingState from "../components/ui/LoadingState";
import ProductSelect from "../components/ui/ProductSelect";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { todayInput, toDateInputValue, toLocalDateInputValue } from "../lib/format";
import { BATCH_STATUSES, COLORS, previewBatchNumber } from "../lib/batchFlow";

const emptyForm = {
  product: "",
  color: "Rojo",
  productionLine: "",
  producedQuantity: "",
  targetQuantity: "",
  status: "Programado",
  operator: "",
  startDate: "",
};

const onlyDigits = (v) => v.replace(/\D/g, "");

// Crear o editar un lote de fabricación de stock, con los mismos campos y
// payload que BatchFormModal/useBatchForm de la web. El número lo genera el
// backend (acá solo se muestra la vista previa). Eliminar está en el detalle
// del lote.
export default function LoteFabricacionFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { batches, loading: batchesLoading, crear, actualizar } = useBatches();
  const { employees } = useEmployees();
  const { options: lineOptions } = useProductionLines();
  // «Operario responsable»: solo empleados del Área Fabricación.
  const operators = useMemo(() => employees.filter((e) => e.department === "Fabricación"), [employees]);

  const [form, setForm] = useState(isEditing ? null : { ...emptyForm, startDate: todayInput() });
  const [saving, setSaving] = useState(false);
  // El formulario tal como se abrió al editar: al guardar solo se mandan los campos que cambiaron.
  const original = useRef(null);

  const batch = isEditing ? batches.find((b) => b._id === id) : null;

  useEffect(() => {
    if (!isEditing || form) return;
    if (batch) {
      const opened = {
        product: batch.product || "",
        color: batch.color || "",
        productionLine: batch.productionLine || "",
        producedQuantity: batch.producedQuantity != null ? String(batch.producedQuantity) : "",
        targetQuantity: batch.targetQuantity != null ? String(batch.targetQuantity) : "",
        status: batch.status || "Programado",
        operator: batch.operator?._id || batch.operator || "",
        // Sin fecha de inicio guardada se muestra la de creación (local), pero no se reenvía si no se toca.
        startDate: batch.startDate ? toDateInputValue(batch.startDate) : toLocalDateInputValue(batch.createdAt),
      };
      original.current = opened;
      setForm(opened);
      return;
    }
    if (!batchesLoading) {
      Alert.alert("No se encontró el lote", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, batch, batchesLoading, navigation]);

  // Un lote nuevo arranca en la primera línea activa, como la web (una sola
  // vez, apenas cargan las líneas: después «Sin línea» es una elección).
  const lineDefaulted = useRef(false);
  useEffect(() => {
    if (isEditing || lineDefaulted.current || !lineOptions.length) return;
    lineDefaulted.current = true;
    setForm((f) => (f.productionLine ? f : { ...f, productionLine: lineOptions[0] }));
  }, [isEditing, lineOptions]);

  const numberPreview = isEditing ? batch?.batchNumber : previewBatchNumber(batches);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar lote" : "Nuevo lote de fabricación",
      headerSubtitle: numberPreview || undefined,
    });
  }, [navigation, isEditing, numberPreview]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.product) {
      Alert.alert("Falta información", "Elige la categoría y el producto");
      return;
    }
    // Al editar solo se mandan los campos que cambiaron respecto al lote que se abrió: nunca el estado
    // ni lo producido (cambian con las acciones del lote), y «Sin asignar» manda operator: null.
    let payload;
    if (isEditing) {
      const was = original.current || {};
      payload = {};
      for (const field of ["product", "color", "productionLine", "startDate"]) {
        if (form[field] !== was[field]) payload[field] = form[field];
      }
      if (form.targetQuantity !== was.targetQuantity && form.targetQuantity !== "") payload.targetQuantity = Number(form.targetQuantity);
      if (form.operator !== was.operator) payload.operator = form.operator || null;
      if (Object.keys(payload).length === 0) {
        toast.show("No hay cambios que guardar");
        navigation.goBack();
        return;
      }
    } else {
      payload = {
        ...form,
        producedQuantity: Number(form.producedQuantity) || 0,
        // Sin meta no se manda.
        targetQuantity: form.targetQuantity === "" ? undefined : Number(form.targetQuantity),
        operator: form.operator || undefined,
        startDate: form.startDate || undefined,
      };
    }
    setSaving(true);
    try {
      if (isEditing) {
        await actualizar(id, payload);
        toast.show("Lote actualizado");
      } else {
        const res = await crear(payload);
        toast.show(res?.batchNumber ? `Lote ${res.batchNumber} creado` : "Lote creado");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <LoadingState />;

  const lines = withCurrentLine(lineOptions, form.productionLine);

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <ProductSelect value={form.product} onChange={(v) => handleChange("product", v)} />
        <SelectField
          label="Color"
          value={form.color}
          options={[{ label: "Sin color", value: "" }, ...COLORS.map((c) => ({ label: c, value: c }))]}
          onChange={(v) => handleChange("color", v)}
        />
        <SelectField
          label="Línea de producción"
          value={form.productionLine}
          options={[{ label: "Sin línea", value: "" }, ...lines.map((l) => ({ label: l, value: l }))]}
          onChange={(v) => handleChange("productionLine", v)}
        />
        <FormField
          label="Meta (unidades)"
          value={form.targetQuantity}
          onChangeText={(v) => handleChange("targetQuantity", onlyDigits(v))}
          keyboardType="number-pad"
          suffix="u"
        />
        {/* Al editar no hay producido ni estado: cambian con las acciones del lote (iniciar, completar…). */}
        {isEditing ? null : (
          <>
            <FormField
              label="Cantidad producida"
              value={form.producedQuantity}
              onChangeText={(v) => handleChange("producedQuantity", onlyDigits(v))}
              keyboardType="number-pad"
              suffix="u"
            />
            <SelectField
              label="Estado"
              value={form.status}
              options={BATCH_STATUSES.map((s) => ({ label: s, value: s }))}
              onChange={(v) => handleChange("status", v)}
            />
          </>
        )}
        <SelectField
          label="Operario responsable"
          value={form.operator}
          options={[
            { label: "Sin asignar", value: "" },
            ...operators.map((o) => ({ label: `${o.name} ${o.lastName}`, value: o._id })),
          ]}
          onChange={(v) => handleChange("operator", v)}
        />
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
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
});
