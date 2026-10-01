import { Pressable, StyleSheet, Text, View } from "react-native";
import ColorSwatch from "../ui/ColorSwatch";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatDateYear, formatNumber } from "../../lib/format";
import { batchStart, batchState } from "../../lib/batchFlow";
import { statusTone } from "../../lib/statusTones";

// Fila de un lote en listas tipo tabla (BatchTable de la web): número y
// estado; fecha, producto, color, línea (y operario, con `showOperator`); y
// lo producido. Va dentro de un ListGroup.
export default function BatchRow({ batch, showOperator = false, onPress, onLongPress }) {
  const state = batchState(batch);
  const start = batchStart(batch)?.date || batch.createdAt;
  const operator = batch.operator?.name ? `${batch.operator.name} ${batch.operator.lastName || ""}`.trim() : null;
  const meta = [formatDateYear(start), batch.productionLine, showOperator ? operator : null].filter(Boolean).join(" · ");

  const content = (
    <>
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={styles.number}>{batch.batchNumber}</Text>
          <Pill label={state} tone={statusTone(state, "lote")} />
        </View>
        <View style={styles.top}>
          <ColorSwatch color={batch.color} size={10} />
          <Text style={styles.product} numberOfLines={1}>
            {[batch.product, batch.color].filter(Boolean).join(" · ") || "—"}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={styles.produced}>{formatNumber(batch.producedQuantity)} u</Text>
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 11 },
  pressed: { backgroundColor: colors.surface2 },
  main: { flex: 1, gap: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  product: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  produced: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, fontVariant: ["tabular-nums"] },
});
