import { Pressable, StyleSheet, Text, View } from "react-native";
import Pill from "../ui/Pill";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatMoney, formatShortDate, fromDateOnly } from "../../lib/format";
import { transactionStatusTone } from "../../lib/statusTones";

// date se guarda como medianoche UTC (fecha sin hora); createdAt es un instante real.
const txDay = (t) => (t.date ? fromDateOnly(t.date) : t.createdAt);

// Fila de una transacción (TransactionTable de la web) para ir dentro de un
// ListGroup: concepto y monto (+ verde / − rosa); debajo, referencia, fecha,
// categoría, el pedido ligado y la Pill «Pendiente» si falta cobrar/pagar.
// Con onPress/onLongPress la fila se puede tocar (Finanzas: editar/eliminar).
export default function TransactionRow({ transaction: t, onPress, onLongPress }) {
  const income = t.type === "Ingreso";
  const meta = [t.reference || "—", formatShortDate(txDay(t)), t.category].filter(Boolean).join(" · ");

  const content = (
    <>
      <View style={styles.line}>
        <Text style={styles.concept} numberOfLines={1}>
          {t.concept || "—"}
        </Text>
        <Text style={[styles.amount, { color: income ? tones.green.text : tones.rose.text }]}>
          {income ? "+" : "−"}
          {formatMoney(Math.abs(Number(t.amount) || 0))}
        </Text>
      </View>
      <View style={styles.metaLine}>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {t.relatedOrder?.orderNumber ? (
          <View style={styles.orderChip}>
            <Text style={styles.orderText}>{t.relatedOrder.orderNumber}</Text>
          </View>
        ) : null}
        {t.status === "Pendiente" ? <Pill label="Pendiente" tone={transactionStatusTone(t.status)} /> : null}
      </View>
    </>
  );

  if (!onPress && !onLongPress) return <View style={styles.row}>{content}</View>;

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
  row: { paddingHorizontal: 15, paddingVertical: 11, gap: 4 },
  pressed: { backgroundColor: colors.surface2 },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  concept: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  amount: { fontFamily: fonts.bold, fontSize: 13.5, fontVariant: ["tabular-nums"] },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  orderChip: { backgroundColor: colors.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  orderText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primarySoftText, fontVariant: ["tabular-nums"] },
});
