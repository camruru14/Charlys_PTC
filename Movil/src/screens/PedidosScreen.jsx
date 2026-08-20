import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useOrders } from "../hooks/useOrders";
import OrderCard from "../components/orders/OrderCard";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { filterOrdersList } from "../lib/orderListFilters";

const STATUSES = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];
const PAYMENT = ["Pendiente", "Pagado", "Reembolsado"];

// Lista de pedidos con KPIs y filtros, igual que
// Web/private/frontend/src/pages/Pedidos.jsx. Las acciones operativas
// (verificar, empacar, fabricar, asignar entrega, cambiar estado de pago,
// solicitar a inventario) siguen viviendo en PedidoDetalleScreen — acá se
// agregó, en la Fase 10, crear un pedido nuevo y editar cliente/productos
// (botón "Editar pedido" dentro de PedidoDetalleScreen).
export default function PedidosScreen({ navigation }) {
  const { orders, loading, refreshing, error, refresh } = useOrders();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const kpis = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "Pendiente").length,
      transit: orders.filter((o) => o.status === "En Tránsito").length,
      delivered: orders.filter((o) => o.status === "Entregado").length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () => filterOrdersList(orders, { search, status: statusFilter, paymentStatus: paymentFilter }),
    [orders, search, statusFilter, paymentFilter],
  );

  const hasActiveFilters = Boolean(search || statusFilter || paymentFilter);

  if (loading) return <LoadingState />;
  if (error && orders.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={filteredOrders}
        keyExtractor={(item, index) => item._id || item.orderNumber || String(index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("PedidoDetalle", { id: item._id })}
          >
            <OrderCard order={item} />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            message={
              hasActiveFilters && orders.length > 0
                ? "Ningún pedido coincide con los filtros."
                : "No hay pedidos todavía"
            }
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.kpiGrid}>
              <KpiTile label="Total de pedidos" value={formatNumber(kpis.total)} hint="en sistema" />
              <KpiTile label="Pendientes" value={formatNumber(kpis.pending)} hint={kpis.pending ? "Por procesar" : "Al día"} />
              <KpiTile label="En tránsito" value={formatNumber(kpis.transit)} hint="en ruta" />
              <KpiTile label="Entregados" value={formatNumber(kpis.delivered)} hint="completados" />
            </View>

            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar pedido, cliente, correo…"
              placeholderTextColor={colors.slate400}
            />
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <SelectField
                  title="Estado"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[{ label: "Estado: todos", value: "" }, ...STATUSES.map((s) => ({ label: s, value: s }))]}
                />
              </View>
              <View style={styles.filterItem}>
                <SelectField
                  title="Pago"
                  value={paymentFilter}
                  onChange={setPaymentFilter}
                  options={[{ label: "Pago: todos", value: "" }, ...PAYMENT.map((p) => ({ label: p, value: p }))]}
                />
              </View>
              {hasActiveFilters ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearch("");
                    setStatusFilter("");
                    setPaymentFilter("");
                  }}
                >
                  <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
      />

      <FloatingAddButton onPress={() => navigation.navigate("PedidoForm")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    flexGrow: 1,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 4 },
  filterItem: { minWidth: 150, flexGrow: 1 },
  clearButton: { backgroundColor: colors.neutralSoftBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
});
