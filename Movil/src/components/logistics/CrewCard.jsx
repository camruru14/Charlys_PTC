import { StyleSheet, Text, View } from "react-native";
import Avatar, { personTone } from "../ui/Avatar";
import Button from "../ui/Button";
import Card from "../ui/Card";
import VehiclePhoto from "../ui/VehiclePhoto";
import { colors } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";
import { personName } from "../../lib/logistics";

// Ficha de la unidad de una ruta que todavía no sale (CrewCard de
// pages/logistica/ParaDespacho.jsx en la web): foto, modelo y placa del
// vehículo, y el motorista. «Cambiar» (o «Asignar», si falta alguno) abre el
// CrewSheet. `unit` es el vehículo de /routes/availability buscado por placa;
// si la placa ya no existe en Configuración, solo se muestra la placa.
export default function CrewCard({ route, unit, onEdit }) {
  const plate = route.vehicle || "";
  const driver = route.driver?.name ? route.driver : null;
  const incomplete = !plate || !driver;

  return (
    <Card style={styles.card}>
      <View>
        {plate ? (
          <VehiclePhoto uri={unit?.imageUrl} iconSize={44} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.noVehicle]}>
            <Text style={styles.noVehicleText}>Sin vehículo asignado</Text>
          </View>
        )}
        <Button
          title={incomplete ? "Asignar" : "Cambiar"}
          icon="edit"
          variant="secondary"
          size="small"
          onPress={onEdit}
          style={styles.edit}
        />
      </View>

      {plate ? (
        <View style={styles.block}>
          <Text style={type.overline}>Vehículo</Text>
          {unit?.model ? (
            <Text style={styles.model} numberOfLines={1}>
              {unit.model}
            </Text>
          ) : null}
          <View style={styles.plateBox}>
            <Text style={styles.plate}>{plate}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.block}>
        <Text style={type.overline}>Motorista</Text>
        {driver ? (
          <View style={styles.driver}>
            <Avatar name={personName(driver)} tone={personTone(driver)} size={40} />
            <View style={styles.driverTexts}>
              <Text style={styles.driverName} numberOfLines={1}>
                {personName(driver)}
              </Text>
              {driver.phone ? <Text style={styles.phone}>{driver.phone}</Text> : null}
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>Sin motorista asignado</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, marginBottom: 10 },
  photo: { width: "100%", aspectRatio: 2, borderRadius: 10 },
  noVehicle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: "transparent",
  },
  noVehicleText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  edit: { position: "absolute", top: 8, right: 8 },
  block: { marginTop: 12, gap: 4 },
  model: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  plateBox: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plate: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.lineSoft, marginTop: 12 },
  driver: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  driverTexts: { flex: 1, gap: 1 },
  driverName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  phone: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
});
