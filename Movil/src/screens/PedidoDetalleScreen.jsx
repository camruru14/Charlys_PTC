import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useOrders } from "../hooks/useOrders";
import { useWarehouses } from "../hooks/useWarehouses";
import { useEmployees } from "../hooks/useEmployees";
import { useVehicles } from "../hooks/useVehicles";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import MiniButton from "../components/ui/MiniButton";
import CustomButton from "../components/ui/CustomButton";
import SegmentedField from "../components/ui/SegmentedField";
import DeleteButton from "../components/ui/DeleteButton";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import OrderItemCard from "../components/orders/OrderItemCard";
import VerifyItemModal from "../components/orders/VerifyItemModal";
import DeliveryFormModal from "../components/orders/DeliveryFormModal";
import { colors } from "../lib/theme";
import { formatCurrency } from "../lib/format";
import { orderStatusTone, dispatchStatusTone } from "../lib/statusTones";

const PAYMENT_STATUSES = ["Pendiente", "Pagado", "Reembolsado"];

// Pantalla única de detalle de pedido: consolida lo que en la web está
// repartido en 4 pestañas (Pedidos, Inventario > Pedidos, Fabricación >
// Pedidos, Logística) — mismo backend, mismos endpoints, solo mostrando en
// cada momento los botones que correspondan al estado actual de cada línea.
export default function PedidoDetalleScreen({ navigation, route }) {
  const id = route.params?.id;
  const {
    orders,
    loading,
    error,
    refresh,
    eliminar,
    requestInventory,
    verifyItem,
    packItem,
    sendToManufacturing,
    manufactureItem,
    packManufacturedItem,
    assignDelivery,
    confirmPickup,
    updatePaymentStatus,
  } = useOrders();
  const { warehouses } = useWarehouses();
  const { employees } = useEmployees();
  const { vehicles } = useVehicles();
  const drivers = employees.filter((e) => e.department === "Logística");

  const order = orders.find((o) => o._id === id);

  const [busyKey, setBusyKey] = useState(null);
  const [verifyIndex, setVerifyIndex] = useState(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState("");
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (order) navigation.setOptions({ title: order.orderNumber });
  }, [order, navigation]);

  if (!order) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="No se encontró el pedido" />;
  }

  const requested = Boolean(order.inventoryRequestedAt);

  const handleRequestInventory = async () => {
    setBusyKey("request");
    try {
      await requestInventory(order._id);
    } catch (error) {
      Alert.alert("No se pudo solicitar", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleVerifySave = async (warehouse) => {
    if (!warehouse) {
      Alert.alert("Falta información", "Elegí una bodega");
      return;
    }
    setBusyKey(`verify-${verifyIndex}`);
    try {
      await verifyItem(order._id, verifyIndex, warehouse);
      setVerifyIndex(null);
    } catch (error) {
      Alert.alert("No se pudo verificar", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSendToManufacturing = async (index) => {
    setBusyKey(`send-${index}`);
    try {
      await sendToManufacturing(order._id, index);
    } catch (error) {
      Alert.alert("No se pudo enviar a fabricación", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePack = async (index) => {
    setBusyKey(`pack-${index}`);
    try {
      await packItem(order._id, index);
    } catch (error) {
      Alert.alert("No se pudo empacar", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleManufacture = async (index) => {
    setBusyKey(`manufacture-${index}`);
    try {
      await manufactureItem(order._id, index);
    } catch (error) {
      Alert.alert("No se pudo fabricar", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePackManufactured = async (index) => {
    setBusyKey(`packm-${index}`);
    try {
      await packManufacturedItem(order._id, index);
    } catch (error) {
      Alert.alert("No se pudo empacar", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeliverySave = async (payload) => {
    if (!payload.driver) {
      Alert.alert("Falta información", "Elegí un motorista");
      return;
    }
    setBusyKey("delivery");
    try {
      await assignDelivery(order._id, payload);
      setDeliveryModalOpen(false);
    } catch (error) {
      Alert.alert("No se pudo guardar la entrega", error.message || "Intentá de nuevo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmPickup = async (location) => {
    setConfirmingPickup(location);
    try {
      await confirmPickup(order._id, location);
    } catch (error) {
      Alert.alert("No se pudo confirmar", error.message || "Intentá de nuevo");
    } finally {
      setConfirmingPickup("");
    }
  };

  const handlePaymentStatusChange = async (paymentStatus) => {
    if (paymentStatus === order.paymentStatus) return;
    setUpdatingPayment(true);
    try {
      await updatePaymentStatus(order, paymentStatus);
    } catch (error) {
      Alert.alert("No se pudo actualizar el pago", error.message || "Intentá de nuevo");
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eliminar(order._id);
      navigation.goBack();
    } catch (error) {
      setDeleting(false);
      Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
    }
  };

  const requiresWarehousePickup = order.items.some((i) => i.packedLocation === "Almacén");
  const requiresFactoryPickup = order.items.some((i) => i.packedLocation === "Fabricación");
  const showWarehousePickup = requiresWarehousePickup && !order.delivery?.pickupWarehouseAt;
  const showFactoryPickup = requiresFactoryPickup && !order.delivery?.pickupFactoryAt;

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.customerName}>{order.customer?.name || "Cliente sin nombre"}</Text>
        {order.customer?.email ? <Text style={styles.customerDetail}>{order.customer.email}</Text> : null}
        {order.customer?.phone ? <Text style={styles.customerDetail}>{order.customer.phone}</Text> : null}
        {order.customer?.address ? <Text style={styles.customerDetail}>{order.customer.address}</Text> : null}

        <View style={styles.orderMetaRow}>
          <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
          <Badge label={order.status} tone={orderStatusTone(order.status)} />
        </View>
        {order.notes ? <Text style={styles.notes}>Notas: {order.notes}</Text> : null}
      </Card>

      <View style={styles.actions}>
        <MiniButton
          label="Editar pedido"
          variant="neutral"
          onPress={() => navigation.navigate("PedidoForm", { id: order._id })}
        />
      </View>

      {!requested ? (
        <View style={styles.section}>
          <CustomButton
            title="Solicitar a Inventario"
            onPress={handleRequestInventory}
            loading={busyKey === "request"}
          />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Productos</Text>
      {order.items.map((item, index) => (
        <OrderItemCard
          key={index}
          item={item}
          requested={requested}
          busy={
            busyKey === `verify-${index}` ||
            busyKey === `send-${index}` ||
            busyKey === `pack-${index}` ||
            busyKey === `manufacture-${index}` ||
            busyKey === `packm-${index}`
          }
          onVerify={() => setVerifyIndex(index)}
          onSendToManufacturing={() => handleSendToManufacturing(index)}
          onPack={() => handlePack(index)}
          onManufacture={() => handleManufacture(index)}
          onPackManufactured={() => handlePackManufactured(index)}
        />
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entrega</Text>
        {order.delivery?.driver ? (
          <Card>
            <Text style={styles.deliveryText}>
              Motorista: {order.delivery.driver.name} {order.delivery.driver.lastName}
            </Text>
            {order.delivery.vehicle ? (
              <Text style={styles.deliveryText}>Vehículo: {order.delivery.vehicle}</Text>
            ) : null}
            <View style={styles.deliveryBadgeRow}>
              <Badge label={order.delivery.dispatchStatus} tone={dispatchStatusTone(order.delivery.dispatchStatus)} />
            </View>

            <View style={styles.actions}>
              <MiniButton
                label="Editar entrega"
                variant="neutral"
                onPress={() => setDeliveryModalOpen(true)}
              />
            </View>

            {showWarehousePickup || showFactoryPickup ? (
              <View style={styles.pickupChecklist}>
                <Text style={styles.subTitle}>Recolección pendiente</Text>
                <View style={styles.actions}>
                  {showWarehousePickup ? (
                    <MiniButton
                      label="Confirmar recolección en Almacén"
                      onPress={() => handleConfirmPickup("Almacén")}
                      loading={confirmingPickup === "Almacén"}
                    />
                  ) : null}
                  {showFactoryPickup ? (
                    <MiniButton
                      label="Confirmar recolección en Fabricación"
                      onPress={() => handleConfirmPickup("Fabricación")}
                      loading={confirmingPickup === "Fabricación"}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
          </Card>
        ) : (
          <MiniButton label="Asignar entrega" onPress={() => setDeliveryModalOpen(true)} loading={busyKey === "delivery"} />
        )}
      </View>

      <View style={styles.section}>
        <SegmentedField
          label="Estado de pago"
          value={order.paymentStatus}
          options={PAYMENT_STATUSES}
          onChange={handlePaymentStatusChange}
        />
        {updatingPayment ? <Text style={styles.savingText}>Actualizando…</Text> : null}
      </View>

      <DeleteButton
        label={deleting ? "Eliminando…" : "Eliminar pedido"}
        confirmMessage={`¿Eliminar el pedido ${order.orderNumber}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        disabled={deleting}
      />

      <VerifyItemModal
        visible={verifyIndex !== null}
        item={verifyIndex !== null ? order.items[verifyIndex] : null}
        warehouses={warehouses}
        saving={busyKey === `verify-${verifyIndex}`}
        onClose={() => setVerifyIndex(null)}
        onSave={handleVerifySave}
      />

      <DeliveryFormModal
        visible={deliveryModalOpen}
        order={order}
        drivers={drivers}
        vehicles={vehicles}
        saving={busyKey === "delivery"}
        onClose={() => setDeliveryModalOpen(false)}
        onSave={handleDeliverySave}
      />
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
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  customerDetail: {
    marginTop: 2,
    fontSize: 13,
    color: colors.slate500,
  },
  orderMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand700,
  },
  notes: {
    marginTop: 8,
    fontSize: 12,
    color: colors.slate500,
    fontStyle: "italic",
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  deliveryText: {
    fontSize: 13,
    color: colors.slate700,
  },
  deliveryBadgeRow: {
    marginTop: 8,
    alignItems: "flex-start",
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickupChecklist: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate700,
    marginBottom: 4,
  },
  savingText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.slate500,
  },
});
