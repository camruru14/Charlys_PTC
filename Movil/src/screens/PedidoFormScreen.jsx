import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useOrders } from "../hooks/useOrders";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { formatCurrency } from "../lib/format";
import { orderStatusToneDetailed } from "../lib/statusTones";

const PAYMENT_STATUSES = ["Pendiente", "Pagado", "Reembolsado"];
const PRODUCTS = ["Pajilla", "Pelota"];
const COLOR_OPTIONS = [
  { label: "Sin color", value: "" },
  { label: "Rojo", value: "Rojo" },
  { label: "Azul", value: "Azul" },
  { label: "Verde", value: "Verde" },
  { label: "Blanco", value: "Blanco" },
  { label: "Negro", value: "Negro" },
  { label: "Amarillo", value: "Amarillo" },
];

const emptyForm = { customerName: "", customerEmail: "", customerPhone: "", customerAddress: "", paymentStatus: "Pendiente" };
const emptyLine = { product: "Pajilla", color: "", quantity: "", unitPrice: "" };

// Vista previa del próximo N° de pedido (el backend genera el definitivo al
// guardar) — mismo criterio que previewOrderNumber() en
// Web/private/frontend/src/pages/Pedidos.jsx.
function previewOrderNumber(orders) {
  const prefix = `ORD-${new Date().getFullYear()}-`;
  const lastNumber = orders.reduce((max, o) => {
    if (!o.orderNumber?.startsWith(prefix)) return max;
    const n = parseInt(o.orderNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

export default function PedidoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { orders, loading: ordersLoading, crear, actualizar, eliminar } = useOrders();

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("Pendiente");
  const [items, setItems] = useState([]);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const order = orders.find((o) => o._id === id);
    if (order) {
      setForm({
        customerName: order.customer?.name || "",
        customerEmail: order.customer?.email || "",
        customerPhone: order.customer?.phone || "",
        customerAddress: order.customer?.address || "",
        paymentStatus: order.paymentStatus || "Pendiente",
      });
      setStatus(order.status || "Pendiente");
      setItems(
        (order.items || []).map((i) => ({
          product: i.product,
          color: i.color || "",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal ?? i.quantity * i.unitPrice,
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

  const orderNumberPreview = useMemo(
    () => (isEditing ? orders.find((o) => o._id === id)?.orderNumber || "" : previewOrderNumber(orders)),
    [isEditing, id, orders],
  );

  const total = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleLineChange = (field, value) => setLineForm((f) => ({ ...f, [field]: value }));

  const addLine = () => {
    const quantity = Number(lineForm.quantity) || 0;
    const unitPrice = Number(lineForm.unitPrice) || 0;
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
      status,
      paymentStatus: form.paymentStatus,
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
    title: isEditing ? "Editar pedido" : "Nuevo pedido",
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
      <View style={styles.orderNumberBox}>
        <Text style={styles.orderNumberLabel}>Número de pedido</Text>
        <Text style={styles.orderNumberValue}>{orderNumberPreview}</Text>
      </View>

      <FormField label="Cliente" value={form.customerName} onChangeText={(v) => handleChange("customerName", v)} required />
      <FormField
        label="Correo del cliente"
        value={form.customerEmail}
        onChangeText={(v) => handleChange("customerEmail", v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField label="Teléfono" value={form.customerPhone} onChangeText={(v) => handleChange("customerPhone", v)} keyboardType="phone-pad" />
      <FormField label="Dirección" value={form.customerAddress} onChangeText={(v) => handleChange("customerAddress", v)} />

      {/* El estado del pedido avanza solo según lo que pasa en
          Inventario/Fabricación/Logística — acá solo se muestra de
          referencia, igual que en la web. */}
      <View style={styles.readonlyField}>
        <Text style={styles.readonlyLabel}>Estado</Text>
        <Badge label={status} tone={orderStatusToneDetailed(status)} />
      </View>

      <SegmentedField
        label="Estado de pago"
        value={form.paymentStatus}
        options={PAYMENT_STATUSES}
        onChange={(v) => handleChange("paymentStatus", v)}
      />

      <Text style={styles.sectionTitle}>Productos del pedido</Text>
      <Card style={styles.lineBuilder}>
        <SegmentedField
          label="Producto"
          value={lineForm.product}
          options={PRODUCTS}
          onChange={(v) => handleLineChange("product", v)}
        />
        <SegmentedField
          label="Color"
          value={lineForm.color}
          options={COLOR_OPTIONS}
          getLabel={(o) => o.label}
          getValue={(o) => o.value}
          onChange={(v) => handleLineChange("color", v)}
        />
        <FormField
          label="Cantidad"
          value={lineForm.quantity}
          onChangeText={(v) => handleLineChange("quantity", v)}
          keyboardType="numeric"
        />
        <FormField
          label="Precio unitario ($)"
          value={lineForm.unitPrice}
          onChangeText={(v) => handleLineChange("unitPrice", v)}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.addLineButton} onPress={addLine} activeOpacity={0.85}>
          <Text style={styles.addLineButtonText}>+ Agregar producto</Text>
        </TouchableOpacity>
      </Card>

      {items.length === 0 ? (
        <Text style={styles.emptyItems}>Aún no hay productos agregados a este pedido.</Text>
      ) : (
        items.map((it, idx) => (
          <Card key={idx} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {it.product}
                {it.color ? ` · ${it.color}` : ""}
              </Text>
              <TouchableOpacity onPress={() => removeLine(idx)} hitSlop={8}>
                <Text style={styles.removeText}>Quitar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.itemMeta}>
              {it.quantity} unidad{it.quantity === 1 ? "" : "es"} · {formatCurrency(it.unitPrice)} c/u · {formatCurrency(it.subtotal)}
            </Text>
          </Card>
        ))
      )}

      <View style={styles.totalBox}>
        <Text style={styles.totalText}>
          Total del pedido: <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </Text>
      </View>

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar el pedido ${orderNumberPreview}? Esta acción no se puede deshacer.`}
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
    paddingBottom: 32,
  },
  orderNumberBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate200,
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  orderNumberLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.slate500,
  },
  orderNumberValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  readonlyField: {
    marginBottom: 16,
  },
  readonlyLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  lineBuilder: {
    marginBottom: 12,
  },
  addLineButton: {
    marginTop: 4,
    backgroundColor: colors.brand600,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  addLineButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyItems: {
    fontSize: 13,
    color: colors.slate500,
    marginBottom: 12,
  },
  itemCard: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  removeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.slate500,
  },
  totalBox: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalText: {
    fontSize: 13,
    color: colors.slate700,
  },
  totalValue: {
    fontWeight: "800",
    color: colors.text,
  },
});
