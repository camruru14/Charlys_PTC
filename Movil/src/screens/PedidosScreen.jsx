import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import OrderCard from "../components/orders/OrderCard";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterSelectChip from "../components/ui/FilterSelectChip";
import GroupHeader from "../components/ui/GroupHeader";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import { useDateRange, rangeLabel } from "../context/DateRangeContext";
import { colors, getTone } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { statusTone } from "../lib/statusTones";
import { PEDIDO_GROUPS, groupOrders, matchesOrderSearch } from "../lib/orderList";
import { useBottomPad } from "../hooks/useBottomPad";
import MarkAllSeen from "../components/ui/MarkAllSeen";
import { useActivity } from "../hooks/useActivity";

// Lista de pedidos, como Web/private/frontend/src/pages/Pedidos.jsx: búsqueda
// por N° de pedido, cliente o correo, filtro «Estado» y lista agrupada por
// estado. El rango de fechas (DateRangeButton) solo filtra «Entregado»: los
// pedidos no entregados se ven siempre. Al tocar uno se abre su detalle
// (PedidoDetalleScreen). Los pedidos llegan de la tienda en línea: la
// app no los crea ni los edita.
export default function PedidosScreen({ navigation, route }) {
  const bottomPad = useBottomPad(32);
  const { orders, loading, refreshing, error, refresh } = useOrders();
  const [search, setSearch] = useState("");
  const range = useDateRange();
  const [estado, setEstado] = useState("");

  // El Dashboard abre Pedidos ya filtrado por etapa: navigate("Pedidos", { estado: "empacado", at }).
  // `at` distingue una visita nueva con la misma etapa.
  const estadoParam = route?.params?.estado;
  const estadoAt = route?.params?.at;
  useEffect(() => {
    if (estadoParam !== undefined) setEstado(estadoParam);
  }, [estadoParam, estadoAt]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Novedades: los pedidos nuevos o que cambiaron se marcan hasta que se abren.
  const { isUnseen, markSeen } = useActivity();

  const activeCount = useMemo(() => orders.filter((o) => o.status !== "Entregado").length, [orders]);

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle: `${formatNumber(activeCount)} activos · tienda en línea`,
      headerRight: () => <DateRangeButton />,
    });
  }, [navigation, activeCount]);

  // Grupos con la búsqueda y el rango (los conteos del filtro «Estado» salen de
  // aquí); no se muestran los grupos vacíos ni los que no son el estado elegido.
  const found = useMemo(() => orders.filter((o) => matchesOrderSearch(o, search)), [orders, search]);
  const allGroups = useMemo(() => groupOrders(found, range), [found, range]);
  const sections = useMemo(
    () =>
      allGroups
        .filter((g) => g.items.length > 0 && (!estado || g.key === estado))
        .map((g) => ({ key: g.key, title: g.label, note: g.note, count: g.items.length, data: g.items })),
    [allGroups, estado],
  );
  const visibleCount = useMemo(() => sections.reduce((n, s) => n + s.count, 0), [sections]);
  const stateOptions = useMemo(
    () =>
      allGroups.map((g) => ({
        value: g.key,
        label: g.status,
        dot: getTone(statusTone(g.status, "pedido")).dot,
        meta: formatNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    [allGroups],
  );
  const totalFound = useMemo(() => allGroups.reduce((n, g) => n + g.items.length, 0), [allGroups]);
  const estadoGroup = PEDIDO_GROUPS.find((g) => g.key === estado);

  if (loading) return <LoadingState />;
  if (error && orders.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={[styles.content, bottomPad]}
      sections={sections}
      keyExtractor={(item, index) => item._id || item.orderNumber || String(index)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <GroupHeader title={section.title} note={section.note} count={section.count} />}
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          unseen={isUnseen("pedidos", item._id)}
          onPress={() => {
            markSeen("pedidos", item._id);
            navigation.navigate("PedidoDetalle", { id: item._id });
          }}
        />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <MarkAllSeen activityKey="pedidos" />
          <SearchField value={search} onChangeText={setSearch} placeholder="Buscar pedido, cliente o correo" />
          <View style={styles.filterRow}>
            <FilterSelectChip
              label="Estado"
              allLabel="todos"
              allMeta={formatNumber(totalFound)}
              size="lg"
              value={estado}
              options={stateOptions}
              onChange={setEstado}
            />
            <View style={styles.summary}>
              <Text style={styles.summaryCount}>
                {formatNumber(visibleCount)} {visibleCount === 1 ? "pedido" : "pedidos"}
              </Text>
              <Text style={styles.summaryRange} numberOfLines={1}>
                {rangeLabel(range)}
              </Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="orders"
          message={
            estadoGroup
              ? `No hay pedidos «${estadoGroup.status}» ${estadoGroup.ranged ? "en este rango" : "con estos filtros"}.`
              : search.trim()
                ? "No hay pedidos con estos filtros."
                : "No hay pedidos. Los pedidos llegan desde la tienda en línea."
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  header: { gap: 10, marginBottom: 12 },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summary: { flex: 1, alignItems: "flex-end" },
  summaryCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  summaryRange: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
