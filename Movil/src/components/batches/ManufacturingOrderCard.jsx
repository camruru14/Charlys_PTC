import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors, getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatNumber } from "../../lib/format";
import { lotState, miniSegments } from "../../lib/orderManufacturing";
import { statusTone } from "../../lib/statusTones";

// Tarjeta de un pedido en Fabricación > Pedidos: número, estado del pedido
// en fabricación, cliente, avance en 4 tramos (Programado, En proceso,
// Completado, Empacado) y sus lotes. Tocar un lote abre su detalle. Las
// acciones de todo el pedido son las de la web: reanudar los detenidos y
// empacar los completados.
export default function ManufacturingOrderCard({ group, busy, onOpenLot, onOpenOrder, onResume, onPackCompleted }) {
  const { order, lots, stopped } = group;
  const completed = lots.filter((l) => lotState(l) === "Completado");

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.number}>{order.orderNumber}</Text>
        <Pill label={group.macro} tone={statusTone(group.macro, "pedido-fabricacion")} />
      </View>
      <View style={[styles.row, styles.second]}>
        <Text style={styles.customer} numberOfLines={1}>
          {order.customer?.name || "—"}
        </Text>
        <Text style={styles.count}>
          {formatNumber(lots.length)} {lots.length === 1 ? "lote" : "lotes"}
        </Text>
      </View>
      <View style={styles.bar} accessible accessibilityLabel={`Avance: ${group.macro}`}>
        {miniSegments(group).map((s) => (
          <View key={s.label} style={[styles.segment, { backgroundColor: s.tone ? getTone(s.tone).dot : colors.line }]} />
        ))}
      </View>

      <View style={styles.lots}>
        {lots.map((lot) => {
          const state = lotState(lot);
          return (
            <Pressable
              key={lot.batch._id}
              onPress={() => onOpenLot(lot)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.lot, pressed && styles.pressed]}
            >
              <View style={styles.lotTexts}>
                <Text style={styles.lotName} numberOfLines={1}>
                  {[lot.item.product, lot.item.color].filter(Boolean).join(" · ")}
                </Text>
                <Text numberOfLines={1} style={styles.lotMeta}>
                  {lot.batch.batchNumber}
                  {lot.qty != null ? ` · ${formatNumber(lot.qty)} u` : ""}
                </Text>
              </View>
              <Pill label={state} tone={statusTone(state, "lote")} />
              <Icon name="chevronRight" size={16} color={colors.chevron} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onOpenOrder} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Ver pedido</Text>
        </Pressable>
        <View style={styles.actions}>
          {stopped.length ? (
            <Button
              title={stopped.length === 1 ? "Reanudar" : `Reanudar · ${stopped.length}`}
              size="small"
              variant="secondary"
              disabled={busy}
              onPress={() => onResume(stopped)}
            />
          ) : null}
          {completed.length ? (
            <Button
              title={`Empacar · ${completed.length}`}
              size="small"
              icon="box"
              disabled={busy}
              onPress={() => onPackCompleted(completed)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  second: { marginTop: 4 },
  number: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  customer: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  bar: { flexDirection: "row", gap: 4, marginTop: 12 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  lots: { marginTop: 10 },
  lot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  pressed: { opacity: 0.6 },
  lotTexts: { flex: 1, gap: 2 },
  lotName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  lotMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  actions: { flexDirection: "row", gap: 8 },
});
