import { useCallback, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useInventory } from "../hooks/useInventory";
import { useWarehouses } from "../hooks/useWarehouses";
import InlineNameRow from "../components/settings/InlineNameRow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { useBottomPad } from "../hooks/useBottomPad";

// Abreviatura de cada unidad de inventario en el resumen de una bodega.
const UNIT_ABBR = { unidad: "u", unidades: "u" };

// Configuración > Bodegas (Configuracion.jsx de la web): el nombre se cambia
// en la misma fila y una bodega con existencia no se puede eliminar. «+»
// agrega una (BodegaFormScreen).
export default function ConfigBodegasScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { warehouses, loading, refreshing, error, refresh, actualizar, eliminar } = useWarehouses();
  const { items, refresh: refreshInventory } = useInventory();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshInventory();
    }, [refresh, refreshInventory]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Bodegas",
      headerSubtitle: "Toca el nombre para cambiarlo",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => navigation.navigate("BodegaForm")} accessibilityLabel="Agregar bodega" />
      ),
    });
  }, [navigation]);

  // Existencia por bodega: artículos con stock en esa ubicación y total por
  // unidad («34 artículos · 41,200 u · 350 kg»).
  const stockByWarehouse = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      if (!i.location || !(i.stock > 0)) return;
      const entry = map.get(i.location) || { items: 0, units: new Map() };
      entry.items += 1;
      const unit = UNIT_ABBR[i.unit] || i.unit || "u";
      entry.units.set(unit, (entry.units.get(unit) || 0) + Number(i.stock));
      map.set(i.location, entry);
    });
    return map;
  }, [items]);

  const remove = (w) =>
    Alert.alert(
      "Eliminar bodega",
      `¿Eliminar la bodega «${w.name}»? Ya no se podrá elegir para enviar lotes ni verificar pedidos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminar(w._id);
              toast.show("Bodega eliminada");
            } catch (err) {
              Alert.alert("No se pudo eliminar", err.message);
            } finally {
              refreshInventory();
            }
          },
        },
      ],
    );

  if (loading && !warehouses.length) return <LoadingState />;
  if (error && !warehouses.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {warehouses.length ? (
        <ListGroup>
          {warehouses.map((w) => {
            const stock = stockByWarehouse.get(w.name);
            const detail = stock
              ? [
                  `${formatNumber(stock.items)} ${stock.items === 1 ? "artículo" : "artículos"}`,
                  ...[...stock.units].map(([unit, total]) => `${formatNumber(total)} ${unit}`),
                ].join(" · ")
              : "Sin existencia";
            return (
              <InlineNameRow
                key={w._id}
                icon="box"
                value={w.name}
                detail={detail}
                label="nombre de la bodega"
                onSave={async (name) => {
                  await actualizar(w._id, { name });
                  toast.show("Bodega actualizada");
                }}
                onDelete={() => remove(w)}
                deleteBlocked={Boolean(stock)}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState icon="box" message="No hay bodegas registradas." />
      )}
      <Text style={styles.note}>Una bodega con existencia no se puede eliminar.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
