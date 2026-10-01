import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useOrders } from "../hooks/useOrders";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import SegmentedField from "../components/ui/SegmentedField";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { FieldLabel } from "../components/ui/fieldStyles";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatMoney, formatNumber } from "../lib/format";
import { statusTone } from "../lib/statusTones";

// Mismas opciones que Web/private/frontend/src/pages/Pedidos.jsx.
const PAYMENT = ["Pendiente", "Pagado", "Reembolsado"];
const PRODUCTS = ["Pajilla", "Pelota"];
const COLOR_OPTIONS = [
  { label: "Sin color", value: "" },
  ...["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"].map((c) => ({ label: c, value: c })),
];

const emptyForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  status: "Pendiente",
  paymentStatus: "Pendiente",
};

// Línea en construcción, antes de agregarse a la lista de productos.
const emptyLine = { product: "Pajilla", color: "Rojo", quantity: "", unitPrice: "" };

// Solo dígitos (cantidad) o dígitos con un punto decimal (precio): el
// equivalente a blockNegativeKey de la web.
const onlyDigits = (v) => v.replace(/[^\d]/g, "");
const onlyDecimal = (v) => v.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

// Vista previa del próximo N° de pedido (el backend genera el definitivo al
// guardar), igual que previewOrderNumber() de la web.
function previewOrderNumber(orders) {
  const prefix = `ORD-${new Date().getFullYear()}-`;
  const lastNumber = orders.reduce((max, o) => {
    if (!o.orderNumber?.startsWith(prefix)) return max;
    const n = parseInt(o.orderNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

// Crear o editar un pedido: mismos campos, validaciones y payload que el
// modal de Web/private/frontend/src/pages/Pedidos.jsx. Eliminar está en el
// detalle del pedido (como en la web).
export default function PedidoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();
  const { orders, loading: ordersLoading, crear, actualizar } = useOrders();

  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const order = orders.find((o) => o._id === id);
    if (order) {
      setForm({
        customerName: order.customer?.name || "",
        customerEmail: order.customer?.email || "",
        customerPhone: order.customer?.phone || "",
        customerAddress: order.customer?.address || "",
        status: order.status || "Pendiente",
        paymentStatus: order.paymentStatus || "Pendiente",
      });
      // Igual que openEdit() de la web: se conservan los campos de avance de
      // cada línea (verificado, empacado, enviado a fabricación, lote…) para
      // que editar el cliente o el pago no borre el progreso. El lote viene
      // populado: se manda solo su id. sourceIndex le dice al backend de qué
      // línea original viene cada una: si se quita o cambia una línea con
      // stock tomado, el backend lo devuelve a su bodega (o rechaza si ya
      // está empacada).
      setItems(
        (order.items || []).map((i, idx) => ({
          ...i,
          sourceIndex: idx,
          color: i.color || "",
          subtotal: i.subtotal ?? i.quantity * i.unitPrice,
          manufacturingBatch: i.manufacturingBatch?._id || i.manufacturingBatch || undefined,
        })),
      );
      setLoaded(true);
      return;
    }
    if (!ordersLoading) {
      Alert.alert("No se encontró el pedido", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, orders, ordersLoading, navigation]);

  const orderNumber = useMemo(
    () => (isEditing ? orders.find((o) => o._id === id)?.orderNumber || "" : previewOrderNumber(orders)),
    [isEditing, id, orders],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar pedido" : "Nuevo pedido",
      headerSubtitle: orderNumber,
    });
  }, [navigation, isEditing, orderNumber]);

  const total = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleLineChange = (field, value) => setLineForm((f) => ({ ...f, [field]: value }));

  const addLine = () => {
    const quantity = Number(lineForm.quantity) || 0;
    const unitPrice = Number(lineForm.unitPrice) || 0;
    if (!lineForm.product) {
      Alert.alert("Falta información", "Selecciona un producto");
      return;
    }
    if (quantity <= 0) {
      Alert.alert("Falta información", "La cantidad debe ser mayor a 0");
      return;
    }
    setItems((prev) => [
      ...prev,
      { product: lineForm.product, color: lineForm.color, quantity, unitPrice, subtotal: quantity * unitPrice },
    ]);
    setLineForm(emptyLine);
  };

  const removeLine = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!form.customerName.trim()) {
      Alert.alert("Falta información", "El nombre del cliente es obligatorio");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Falta información", "Agrega al menos un producto al pedido");
      return;
    }
    setSaving(true);
    const payload = {
      customer: {
        name: form.customerName.trim(),
        email: form.customerEmail,
        phone: form.customerPhone,
        address: form.customerAddress,
      },
      items,
      total,
      status: form.status,
      paymentStatus: form.paymentStatus,
    };
    try {
      if (isEditing) {
        await actualizar(id, payload);
        toast.show("Pedido actualizado");
        navigation.goBack();
      } else {
        const res = await crear(payload);
        toast.show(res?.orderNumber ? `Pedido ${res.orderNumber} creado` : "Pedido creado");
        navigation.goBack();
        // Como la web, que deja seleccionado el pedido recién creado.
        if (res?._id) navigation.navigate("PedidoDetalle", { id: res._id });
      }
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && !loaded) return <LoadingState />;

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
        <FormField
          label="Cliente"
          value={form.customerName}
          onChangeText={(v) => handleChange("customerName", v)}
          autoCapitalize="words"
          required
        />
        <FormField
          label="Correo del cliente"
          value={form.customerEmail}
          onChangeText={(v) => handleChange("customerEmail", v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          label="Teléfono"
          value={form.customerPhone}
          onChangeText={(v) => handleChange("customerPhone", v)}
          keyboardType="phone-pad"
        />
        <FormField label="Dirección" value={form.customerAddress} onChangeText={(v) => handleChange("customerAddress", v)} />

        {/* El estado del pedido no se elige a mano: avanza solo según lo que
            pasa en Inventario/Fabricación/Logística. Uno nuevo arranca en
            "Pendiente"; al editar se muestra de referencia. */}
        <View style={styles.readonlyField}>
          <FieldLabel label="Estado" />
          <View style={styles.readonlyBox}>
            <Pill label={form.status} tone={statusTone(form.status, "pedido")} />
          </View>
        </View>

        <SegmentedField
          label="Estado de pago"
          value={form.paymentStatus}
          options={PAYMENT}
          onChange={(v) => handleChange("paymentStatus", v)}
        />

        <Card style={styles.builder}>
          <Text style={[type.overline, styles.builderTitle]}>Productos del pedido</Text>
          <SegmentedField
            label="Producto"
            value={lineForm.product}
            options={PRODUCTS}
            onChange={(v) => handleLineChange("product", v)}
          />
          <SelectField
            label="Color"
            value={lineForm.color}
            options={COLOR_OPTIONS}
            onChange={(v) => handleLineChange("color", v)}
          />
          <View style={styles.pair}>
            <FormField
              style={styles.pairItem}
              label="Cantidad"
              value={lineForm.quantity}
              onChangeText={(v) => handleLineChange("quantity", onlyDigits(v))}
              keyboardType="number-pad"
              suffix="u"
            />
            <FormField
              style={styles.pairItem}
              label="Precio unitario"
              value={lineForm.unitPrice}
              onChangeText={(v) => handleLineChange("unitPrice", onlyDecimal(v))}
              keyboardType="decimal-pad"
              suffix="$"
            />
          </View>
          <Button title="Agregar" icon="plus" variant="soft" onPress={addLine} />

          <View style={styles.itemsList}>
            {items.length === 0 ? (
              <Text style={styles.emptyItems}>Aún no hay productos agregados a este pedido.</Text>
            ) : (
              items.map((it, idx) => (
                <View key={idx} style={[styles.itemRow, idx > 0 && styles.itemDivider]}>
                  <View style={styles.itemTexts}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {[it.product, it.color].filter(Boolean).join(" · ")}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {formatNumber(it.quantity)} u · {formatMoney(it.unitPrice)} c/u
                    </Text>
                  </View>
                  <Text style={styles.itemSubtotal}>{formatMoney(it.subtotal)}</Text>
                  <Pressable
                    onPress={() => removeLine(idx)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${it.product}`}
                    style={styles.remove}
                  >
                    <Icon name="close" size={15} color={tones.rose.text} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </Card>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total del pedido</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      </KeyboardScreen>

      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          {
            title: isEditing ? "Guardar cambios" : "Crear pedido",
            loading: saving,
            onPress: handleSave,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  readonlyField: { marginBottom: 16 },
  readonlyBox: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  builder: { marginTop: 4 },
  builderTitle: { marginBottom: 12 },
  pair: { flexDirection: "row", gap: 10 },
  pairItem: { flex: 1 },
  itemsList: { marginTop: 12 },
  emptyItems: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  itemTexts: { flex: 1, gap: 2 },
  itemName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  itemMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  itemSubtotal: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tones.rose.bg,
  },
  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  totalValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, fontVariant: ["tabular-nums"] },
});
