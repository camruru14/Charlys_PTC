import { Pressable, StyleSheet, Text, View } from "react-native";
import Avatar from "../ui/Avatar";
import LevelMeter from "../ui/LevelMeter";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatShortDate } from "../../lib/format";
import { personName, routeDate, routeLabel, routeProgress } from "../../lib/logistics";
import { statusTone } from "../../lib/statusTones";

// Tarjeta de una ruta de hoy (RouteListRow de EnTransito.jsx en la web):
// «Ruta N · Zona» con su estado, motorista y placa, y el avance de entregas.
export default function RouteCard({ route, onPress }) {
  const { delivered, total } = routeProgress(route);
  const tone = statusTone(route.status, "ruta");
  const driver = personName(route.driver);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {routeLabel(route)} · {route.zone}
          </Text>
          <Text style={styles.date}>
            {route.status === "Completada" ? "Completada" : "Creada"} {formatShortDate(routeDate(route))}
          </Text>
        </View>
        <Pill label={route.status} tone={tone} />
      </View>

      <View style={styles.row}>
        <View style={styles.driver}>
          <Avatar name={driver || "?"} tone={driver ? "blue" : "gray"} size={26} />
          <Text style={[styles.driverName, !driver && styles.muted]} numberOfLines={1}>
            {driver || "Sin motorista asignado"}
          </Text>
        </View>
        <Text style={styles.plate}>{route.vehicle || "—"}</Text>
      </View>

      <View style={styles.row}>
        <LevelMeter value={delivered} max={total} tone={tone} style={styles.meter} />
        <Text style={styles.count}>
          {delivered}/{total}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    gap: 11,
    marginBottom: 10,
  },
  pressed: { backgroundColor: colors.surface2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titles: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  date: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  driver: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  driverName: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  muted: { color: colors.muted },
  plate: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink2, fontVariant: ["tabular-nums"] },
  meter: { flex: 1 },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
