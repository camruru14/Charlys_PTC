import { useCallback, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApi } from "../hooks/useApi";
import { useVehicles } from "../hooks/useVehicles";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import VehiclePhoto from "../components/ui/VehiclePhoto";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

function VehicleRow({ vehicle, busy, onPress }) {
  const status = busy ? "En ruta" : "Disponible";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.model || "Sin modelo"}, placa ${vehicle.plate}, ${status}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <VehiclePhoto uri={vehicle.image?.url} iconSize={20} style={styles.thumb} />
      <View style={styles.texts}>
        <Text style={[styles.model, !vehicle.model && styles.noModel]} numberOfLines={1}>
          {vehicle.model || "Sin modelo"}
        </Text>
        <Text style={styles.plate} numberOfLines={1}>
          {vehicle.plate}
        </Text>
      </View>
      <Pill label={status} tone={statusTone(status, "vehiculo")} />
      <Icon name="chevronRight" size={18} color={colors.chevron} />
    </Pressable>
  );
}

// Configuración > Vehículos (lista de Configuracion.jsx de la web): foto,
// modelo, placa y si va en ruta (/routes/availability). Tocar una fila abre
// VehiculoDetalle; «+» lo abre en modo creación.
export default function ConfigVehiculosScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const { vehicles, loading, refreshing, error, refresh } = useVehicles();
  const { data: availability, refresh: refreshAvailability } = useApi("/routes/availability");

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshAvailability();
    }, [refresh, refreshAvailability]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Vehículos",
      headerSubtitle: "Toca un vehículo para ver su foto y su uso",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => navigation.navigate("VehiculoDetalle")} accessibilityLabel="Agregar vehículo" />
      ),
    });
  }, [navigation]);

  const busyIds = useMemo(
    () => new Set((availability?.vehicles || []).filter((v) => v.busy).map((v) => String(v._id))),
    [availability],
  );

  if (loading && !vehicles.length) return <LoadingState />;
  if (error && !vehicles.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            refreshAvailability();
          }}
        />
      }
    >
      {vehicles.length ? (
        <ListGroup>
          {vehicles.map((v) => (
            <VehicleRow
              key={v._id}
              vehicle={v}
              busy={busyIds.has(String(v._id))}
              onPress={() => navigation.navigate("VehiculoDetalle", { id: v._id })}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon="truck" message="No hay vehículos registrados." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  pressed: { backgroundColor: colors.surface2 },
  thumb: { width: 56, height: 40, borderRadius: 8 },
  texts: { flex: 1, gap: 2 },
  model: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  noModel: { fontFamily: fonts.semibold, color: colors.muted },
  plate: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, fontVariant: ["tabular-nums"] },
});
