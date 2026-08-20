import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useOrders } from "../hooks/useOrders";
import { useEmployees } from "../hooks/useEmployees";
import { useVehicles } from "../hooks/useVehicles";
import DeliveryOrderCard from "../components/logistics/DeliveryOrderCard";
import DeliveryFormModal from "../components/orders/DeliveryFormModal";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { dispatchStatusTone, orderStatusTone } from "../lib/statusTones";
import {
  getRequiredPickups,
  pickupDateFor,
  hasPackedItems,
  driverOptionsFor,
  vehicleOptionsFor,
  statusOptionsFor,
  filterOrders,
} from "../lib/deliveryFilters";

const TABS = [
  { key: "transito", label: "Pedidos en Tránsito" },
  { key: "despacho", label: "Pedidos para despacho" },
];

// Asignación de motoristas/vehículos a pedidos, igual que
// Web/private/frontend/src/pages/Logistica.jsx. El CRUD de Vehículos y
// Bodegas vive en ConfiguracionScreen.jsx desde la Fase 1 (igual que en la
// web, donde ese CRUD está en Configuración, no acá) — no se toca en esta
// fase. `assignDelivery`/`confirmPickup` ya existían en useOrders.js desde
// la Fase 4 (se construyeron para PedidoDetalleScreen), así que esta fase no
// agrega ninguna función nueva al hook.
export default function LogisticaScreen() {
  const { orders, loading, refreshing, error, refresh, assignDelivery, confirmPickup } = useOrders();
  const { employees } = useEmployees();
  const { vehicles } = useVehicles();

  // Igual que la web: sin roles, los motoristas son los empleados del Área
  // "Logística" (ver EmpleadosScreen).
  const drivers = useMemo(() => employees.filter((e) => e.department === "Logística"), [employees]);
  const vehicleOptions = useMemo(() => vehicles.map((v) => v.plate), [vehicles]);
  // Si el vehículo ya guardado en el pedido no está (o ya no está) en
  // Configuración > Vehículos, se agrega igual a las opciones para no perder
  // ni ocultar el valor existente al editar.
  const vehicleOptionsWith = (value) =>
    value && !vehicleOptions.includes(value) ? [...vehicleOptions, value] : vehicleOptions;

  const [activeTab, setActiveTab] = useState("transito");
  const [targetId, setTargetId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState("");

  // Filtros de "Pedidos para despacho".
  const [filterDriver, setFilterDriver] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  // Filtros de "Pedidos en Tránsito", independientes de los de arriba.
  const [transitFilterDriver, setTransitFilterDriver] = useState("");
  const [transitFilterVehicle, setTransitFilterVehicle] = useState("");
  const [transitFilterStatus, setTransitFilterStatus] = useState("");

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const target = useMemo(() => orders.find((o) => o._id === targetId) || null, [orders, targetId]);

  // Pedidos relevantes para logística: con al menos un producto ya empacado
  // o ya en ciclo de despacho activo.
  const shipping = useMemo(
    () => orders.filter((o) => hasPackedItems(o) || ["En Tránsito", "Entregado"].includes(o.status)),
    [orders],
  );
  const dispatchOrders = useMemo(
    () => shipping.filter((o) => !["En Tránsito", "Entregado"].includes(o.status)),
    [shipping],
  );
  const transitOrders = useMemo(
    () => shipping.filter((o) => ["En Tránsito", "Entregado"].includes(o.status)),
    [shipping],
  );

  const busyDriverMap = useMemo(() => {
    const map = new Map();
    shipping.forEach((o) => {
      if (o.status === "Entregado" || !o.delivery?.driver) return;
      const id = typeof o.delivery.driver === "string" ? o.delivery.driver : o.delivery.driver._id;
      if (id) map.set(id, o._id);
    });
    return map;
  }, [shipping]);

  const availableDrivers = useMemo(() => drivers.filter((d) => !busyDriverMap.has(d._id)), [drivers, busyDriverMap]);

  const busyVehicleSet = useMemo(() => {
    const set = new Set();
    shipping.forEach((o) => {
      if (o.status === "Entregado" || !o.delivery?.vehicle) return;
      set.add(o.delivery.vehicle);
    });
    return set;
  }, [shipping]);

  const availableVehicles = useMemo(
    () => vehicleOptions.filter((plate) => !busyVehicleSet.has(plate)),
    [vehicleOptions, busyVehicleSet],
  );

  // Disponibles + el motorista ya asignado al pedido que se está editando
  // (para poder reasignarlo).
  const selectableDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        const busyOrderId = busyDriverMap.get(d._id);
        return !busyOrderId || busyOrderId === target?._id;
      }),
    [drivers, busyDriverMap, target],
  );

  const kpis = useMemo(() => {
    const inTransit = orders.filter((o) => o.status === "En Tránsito").length;
    const delayed = orders.filter((o) => o.delivery?.dispatchStatus === "Demorado").length;
    return { inTransit, delayed };
  }, [orders]);

  const dispatchFilterOptions = useMemo(
    () => ({
      drivers: driverOptionsFor(dispatchOrders),
      vehicles: vehicleOptionsFor(dispatchOrders),
      statuses: statusOptionsFor(dispatchOrders),
    }),
    [dispatchOrders],
  );
  const transitFilterOptions = useMemo(
    () => ({
      drivers: driverOptionsFor(transitOrders),
      vehicles: vehicleOptionsFor(transitOrders),
      statuses: statusOptionsFor(transitOrders),
    }),
    [transitOrders],
  );

  const filteredDispatchOrders = useMemo(
    () => filterOrders(dispatchOrders, { driver: filterDriver, vehicle: filterVehicle, status: filterStatus }),
    [dispatchOrders, filterDriver, filterVehicle, filterStatus],
  );
  const filteredTransitOrders = useMemo(
    () =>
      filterOrders(transitOrders, {
        driver: transitFilterDriver,
        vehicle: transitFilterVehicle,
        status: transitFilterStatus,
      }),
    [transitOrders, transitFilterDriver, transitFilterVehicle, transitFilterStatus],
  );

  const hasActiveDispatchFilters = Boolean(filterDriver || filterVehicle || filterStatus);
  const hasActiveTransitFilters = Boolean(transitFilterDriver || transitFilterVehicle || transitFilterStatus);

  const clearDispatchFilters = () => {
    setFilterDriver("");
    setFilterVehicle("");
    setFilterStatus("");
  };
  const clearTransitFilters = () => {
    setTransitFilterDriver("");
    setTransitFilterVehicle("");
    setTransitFilterStatus("");
  };

  const openModal = (order) => {
    setTargetId(order._id);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (!payload.driver) {
      Alert.alert("Falta información", "Selecciona un motorista");
      return;
    }
    setSaving(true);
    try {
      await assignDelivery(target._id, payload);
      setModalOpen(false);
    } catch (error) {
      Alert.alert("No se pudo guardar la entrega", error.message || "Intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPickup = async (location) => {
    if (!target) return;
    setConfirmingPickup(location);
    try {
      await confirmPickup(target._id, location);
    } catch (error) {
      Alert.alert("No se pudo confirmar", error.message || "Intentá de nuevo");
    } finally {
      setConfirmingPickup("");
    }
  };

  const targetPickups = useMemo(() => {
    if (!target) return [];
    return getRequiredPickups(target).map((location) => ({
      location,
      count: (target.items || []).filter((i) => i.packedLocation === location).length,
      done: Boolean(pickupDateFor(target, location)),
    }));
  }, [target]);

  if (loading) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const isDespacho = activeTab === "despacho";
  const activeOrders = isDespacho ? filteredDispatchOrders : filteredTransitOrders;
  const activeOptions = isDespacho ? dispatchFilterOptions : transitFilterOptions;
  const hasActiveFilters = isDespacho ? hasActiveDispatchFilters : hasActiveTransitFilters;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.kpiGrid}>
          <KpiTile label="Entregas en ruta" value={formatNumber(kpis.inTransit)} hint="En tránsito" />
          <KpiTile label="Motoristas disponibles" value={formatNumber(availableDrivers.length)} hint="libres" />
          <KpiTile label="Vehículos disponibles" value={formatNumber(availableVehicles.length)} hint="libres" />
          <KpiTile
            label="Entregas demoradas"
            value={formatNumber(kpis.delayed)}
            hint={kpis.delayed ? "Atención" : "OK"}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabButton, activeTab === t.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabButtonText, activeTab === t.key && styles.tabButtonTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={activeOrders}
        keyExtractor={(o) => o._id}
        renderItem={({ item: o }) => {
          const pickups = isDespacho
            ? getRequiredPickups(o).map((location) => ({ location, done: Boolean(pickupDateFor(o, location)) }))
            : null;
          const hasDriver = Boolean(o.delivery?.driver);
          const statusLabel = isDespacho
            ? hasDriver
              ? "Recolectando"
              : o.status
            : o.delivery?.dispatchStatus || o.status;
          const statusTone = isDespacho
            ? hasDriver
              ? "blue"
              : orderStatusTone(o.status)
            : o.delivery?.dispatchStatus
              ? dispatchStatusTone(o.delivery.dispatchStatus)
              : orderStatusTone(o.status);
          return (
            <DeliveryOrderCard
              order={o}
              pickups={pickups}
              statusLabel={statusLabel}
              statusTone={statusTone}
              actionLabel={hasDriver ? "Editar" : "Asignar"}
              onAction={() => openModal(o)}
            />
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            message={
              hasActiveFilters
                ? "Ningún pedido coincide con los filtros."
                : isDespacho
                  ? "No hay pedidos para despachar."
                  : "No hay pedidos en tránsito."
            }
          />
        }
        ListHeaderComponent={
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <SelectField
                title="Motorista"
                value={isDespacho ? filterDriver : transitFilterDriver}
                onChange={isDespacho ? setFilterDriver : setTransitFilterDriver}
                options={[
                  { label: "Motoristas: todos", value: "" },
                  ...activeOptions.drivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` })),
                ]}
              />
            </View>
            <View style={styles.filterItem}>
              <SelectField
                title="Vehículo"
                value={isDespacho ? filterVehicle : transitFilterVehicle}
                onChange={isDespacho ? setFilterVehicle : setTransitFilterVehicle}
                options={[
                  { label: "Vehículos: todos", value: "" },
                  ...activeOptions.vehicles.map((v) => ({ value: v, label: v })),
                ]}
              />
            </View>
            <View style={styles.filterItem}>
              <SelectField
                title="Estado"
                value={isDespacho ? filterStatus : transitFilterStatus}
                onChange={isDespacho ? setFilterStatus : setTransitFilterStatus}
                options={[
                  { label: "Estado: todos", value: "" },
                  ...activeOptions.statuses.map((s) => ({ value: s, label: s })),
                ]}
              />
            </View>
            {hasActiveFilters ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={isDespacho ? clearDispatchFilters : clearTransitFilters}
              >
                <Text style={styles.clearButtonText}>Limpiar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <DeliveryFormModal
        visible={modalOpen}
        order={target}
        drivers={selectableDrivers}
        vehicles={vehicleOptionsWith(target?.delivery?.vehicle).map((plate) => ({ plate }))}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        pickups={targetPickups}
        onConfirmPickup={handleConfirmPickup}
        confirmingPickup={confirmingPickup}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: colors.background },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tabBar: { marginBottom: 4 },
  tabButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.neutralSoftBg, marginRight: 8 },
  tabButtonActive: {
    backgroundColor: colors.white,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabButtonText: { fontSize: 13, fontWeight: "600", color: colors.slate500 },
  tabButtonTextActive: { color: colors.brand700, fontWeight: "700" },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  placeholder: { fontSize: 13, color: colors.slate500, paddingVertical: 12 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 },
  filterItem: { minWidth: 150, flexGrow: 1 },
  clearButton: { backgroundColor: colors.neutralSoftBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
});
