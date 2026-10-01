import { useCallback, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useRoutes } from "../hooks/useRoutes";
import { useVehicles } from "../hooks/useVehicles";
import InlineNameRow from "../components/settings/InlineNameRow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { personName } from "../lib/logistics";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

// Configuración > Vehículos (Configuracion.jsx de la web): la placa se cambia
// en la misma fila; el detalle y el estado salen de las rutas de hoy
// (/routes/availability) y un vehículo en ruta no se puede eliminar. «+»
// agrega uno (VehiculoFormScreen).
export default function ConfigVehiculosScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { vehicles, loading, refreshing, error, refresh, actualizar, eliminar } = useVehicles();
  const { routes, availability, refresh: refreshRoutes } = useRoutes();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshRoutes();
    }, [refresh, refreshRoutes]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Vehículos",
      headerSubtitle: "Toca la placa para cambiarla",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => navigation.navigate("VehiculoForm")} accessibilityLabel="Agregar vehículo" />
      ),
    });
  }, [navigation]);

  const vehicleRoutes = useMemo(
    () => new Map((availability?.vehicles || []).filter((v) => v.busy).map((v) => [String(v._id), v.route])),
    [availability],
  );
  // Motorista de cada ruta de hoy (availability solo trae número y zona).
  const routeDrivers = useMemo(() => new Map(routes.map((r) => [String(r._id), personName(r.driver)])), [routes]);

  const remove = (v) =>
    Alert.alert("Eliminar vehículo", `¿Eliminar el vehículo «${v.plate}»? Ya no se podrá elegir al armar rutas.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(v._id);
            toast.show("Vehículo eliminado");
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          } finally {
            refreshRoutes();
          }
        },
      },
    ]);

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
            refreshRoutes();
          }}
        />
      }
    >
      {vehicles.length ? (
        <ListGroup>
          {vehicles.map((v) => {
            const route = vehicleRoutes.get(String(v._id));
            const driver = route ? routeDrivers.get(String(route._id)) : null;
            const detail = route
              ? [`Ruta ${route.number}${route.zone ? ` · ${route.zone}` : ""}`, driver || "sin conductor"].join(" · ")
              : "sin asignar";
            const status = route ? "En ruta" : "Disponible";
            return (
              <InlineNameRow
                key={v._id}
                icon="truck"
                value={v.plate}
                detail={detail}
                label="placa"
                autoCapitalize="characters"
                onSave={async (plate) => {
                  await actualizar(v._id, { plate });
                  toast.show("Vehículo actualizado");
                  refreshRoutes();
                }}
                right={<Pill label={status} tone={statusTone(status, "vehiculo")} />}
                onDelete={() => remove(v)}
                deleteBlocked={Boolean(route)}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState icon="truck" message="No hay vehículos registrados." />
      )}
      <Text style={styles.note}>Un vehículo en ruta no se puede eliminar.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
