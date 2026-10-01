import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import OrderCard from "../components/orders/OrderCard";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";

// Chips de la lista: key -> filtro sobre el pedido (mismos grupos que
// CHIP_FILTERS en Web/private/frontend/src/pages/Pedidos.jsx).
const CHIP_FILTERS = {
  all: () => true,
  pendientes: (o) => o.status === "Pendiente",
  enRuta: (o) => o.status === "En Tránsito",
  sinPago: (o) => o.paymentStatus === "Pendiente",
};

// Lista de pedidos, como Web/private/frontend/src/pages/Pedidos.jsx: búsqueda
// por N° de pedido, cliente o correo + chips. Al tocar uno se abre su
// detalle (PedidoDetalleScreen); el "+" del encabezado crea uno nuevo.
export default function PedidosScreen({ navigation }) {
  const { orders, loading, refreshing, error, refresh } = useOrders();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const activeCount = useMemo(() => orders.filter((o) => o.status !== "Entregado").length, [orders]);

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle: `${formatNumber(activeCount)} activos · tienda en línea`,
      headerRight: () => (
        <IconButton
          icon="plus"
          variant="primary"
          onPress={() => navigation.navigate("PedidoForm")}
          accessibilityLabel="Nuevo pedido"
        />
      ),
    });
  }, [navigation, activeCount]);

  const chipOptions = useMemo(
    () => [
      { value: "all", label: "Todos", count: orders.length },
      { value: "pendientes", label: "Pendientes", count: orders.filter(CHIP_FILTERS.pendientes).length },
      { value: "enRuta", label: "En ruta", count: orders.filter(CHIP_FILTERS.enRuta).length },
      { value: "sinPago", label: "Sin pago", count: orders.filter(CHIP_FILTERS.sinPago).length },
    ],
    [orders],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byChip = CHIP_FILTERS[chip] || CHIP_FILTERS.all;
    return orders.filter((o) => {
      if (!byChip(o)) return false;
      if (!q) return true;
      const haystack = `${o.orderNumber || ""} ${o.customer?.name || ""} ${o.customer?.email || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search, chip]);

  if (loading) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item, index) => item._id || item.orderNumber || String(index)}
      renderItem={({ item }) => (
        <OrderCard order={item} onPress={() => navigation.navigate("PedidoDetalle", { id: item._id })} />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Buscar pedido o cliente" />
          {/* Los chips llegan hasta el borde al desplazarse, con el mismo
              margen de 20 al inicio y al final. */}
          <FilterChips
            options={chipOptions}
            value={chip}
            onChange={setChip}
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="orders"
          message={orders.length === 0 ? "No hay pedidos." : "Ningún pedido coincide con la búsqueda."}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 12 },
  chips: { marginTop: 10, marginHorizontal: -20 },
  chipsContent: { paddingHorizontal: 20 },
});
