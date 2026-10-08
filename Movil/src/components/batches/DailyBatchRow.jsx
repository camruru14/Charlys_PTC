import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import ColorSwatch from "../ui/ColorSwatch";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatNumber, formatRelativeDay, fromDateOnly } from "../../lib/format";

// Fila de un lote diario: producto y color, y debajo su ID y la fecha
// («hoy», «ayer» o «25 sep») y su meta, o «Sin meta» en ámbar. «Programar» lo
// convierte en un lote de fabricación (el backend lo quita de esta lista al
// hacerlo) y exige la meta: sin ella queda deshabilitado y al tocar la fila se
// abre la edición para agregarla.
export default function DailyBatchRow({ batch, busy, onSchedule, onPress, onLongPress }) {
  const date = fromDateOnly(batch.date);
  const hasTarget = Boolean(batch.targetQuantity);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint="Toca para editar; mantén presionado para más opciones"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <View style={styles.top}>
          <ColorSwatch color={batch.color} />
          <Text style={styles.name} numberOfLines={1}>
            {[batch.product, batch.color].filter(Boolean).join(" · ") || "—"}
          </Text>
        </View>
        <Text style={styles.meta}>
          {[batch.dailyBatchNumber, date ? formatRelativeDay(date) : null, hasTarget ? `Meta ${formatNumber(batch.targetQuantity)}` : null]
            .filter(Boolean)
            .join(" · ")}
          {hasTarget ? null : (
            <Text style={styles.noTarget}>
              {batch.dailyBatchNumber || date ? " · " : ""}Sin meta
            </Text>
          )}
        </Text>
      </View>
      <Button title="Programar" size="small" variant="soft" loading={busy} disabled={!hasTarget} onPress={onSchedule} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 11 },
  pressed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  noTarget: { fontFamily: fonts.semibold, color: tones.amber.text },
});
