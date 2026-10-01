import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { dispatchInfo, isPartialReturn, lotNote, orderPickups, routeIdOf, shortName } from "../../lib/logistics";
import { statusTone } from "../../lib/statusTones";

const LOCATION_ICON = { "Almacén": "warehouse", "Fabricación": "factory" };

function PickupChip({ location }) {
  return (
    <View style={styles.chip}>
      <Icon name={LOCATION_ICON[location]} size={12} color={colors.subtle} />
      <Text style={styles.chipText}>{location}</Text>
    </View>
  );
}

// Pedido para despacho (OrderRow de ParaDespacho.jsx en la web). La acción
// de la derecha depende del pedido:
//   - ya va en una ruta: «Ruta N» (con el motorista si no es la que se arma),
//     que abre esa ruta;
//   - un lote lo retiene: nota en cursiva («lote LOTE-XXXX programado»);
//   - hay una ruta armándose: «+ Ruta N» para agregarlo;
//   - si no: «Armar ruta».
export default function DispatchOrderCard({ order, buildingRoute, busy, onAdd, onOpenRoute, onNewRoute, onPress }) {
  const info = dispatchInfo(order);
  const assigned = order.delivery?.route;
  const note = lotNote(order);

  let action;
  if (assigned?.number) {
    const isBuilding = buildingRoute && routeIdOf(order) === String(buildingRoute._id);
    const driver = order.delivery?.driver ? shortName(order.delivery.driver) : null;
    action = (
      <Pressable onPress={() => onOpenRoute(routeIdOf(order))} hitSlop={8} accessibilityRole="link">
        <Text style={styles.routeLink}>
          Ruta {assigned.number}
          {!isBuilding && driver ? ` · ${driver}` : ""}
        </Text>
      </Pressable>
    );
  } else if (note) {
    action = (
      <Text style={styles.note} numberOfLines={1}>
        {note}
      </Text>
    );
  } else if (buildingRoute) {
    action = (
      <Button
        title={`Ruta ${buildingRoute.number}`}
        icon="plus"
        variant="soft"
        size="small"
        disabled={busy}
        onPress={() => onAdd(order)}
      />
    );
  } else {
    action = <Button title="Armar ruta" variant="soft" size="small" disabled={busy} onPress={onNewRoute} />;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Text style={styles.number}>{order.orderNumber}</Text>
          {isPartialReturn(order) ? <Pill label="Entrega parcial" tone={statusTone("Entrega parcial", "despacho")} /> : null}
        </View>
        <Pill label={info.status} tone={statusTone(info.status, "despacho")} />
      </View>

      <View style={styles.row}>
        <Text style={styles.customer} numberOfLines={1}>
          {order.customer?.name || "—"}
        </Text>
        {assigned?.zone ? <Text style={styles.zone}>{assigned.zone}</Text> : null}
      </View>

      <View style={[styles.row, styles.bottom]}>
        <View style={styles.chips}>
          {orderPickups(order).map((l) => (
            <PickupChip key={l} location={l} />
          ))}
        </View>
        {action}
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
    gap: 6,
    marginBottom: 10,
  },
  pressed: { backgroundColor: colors.surface2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  number: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  customer: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  zone: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.subtle },
  bottom: { marginTop: 4, minHeight: 34 },
  chips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    backgroundColor: colors.canvas,
    paddingHorizontal: 7,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink2 },
  routeLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, fontVariant: ["tabular-nums"] },
  note: { flexShrink: 1, fontFamily: fonts.regular, fontStyle: "italic", fontSize: 12, color: colors.muted },
});
