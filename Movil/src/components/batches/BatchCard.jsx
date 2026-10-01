import { Pressable, StyleSheet, Text, View } from "react-native";
import ColorSwatch from "../ui/ColorSwatch";
import LevelMeter from "../ui/LevelMeter";
import Pill from "../ui/Pill";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatAge, formatNumber } from "../../lib/format";
import { batchState } from "../../lib/batchFlow";
import { statusTone } from "../../lib/statusTones";

// Tarjeta de un lote de fabricación (lista de Lotes): código y estado,
// producto y línea, avance producido / meta y una nota según el estado
// («Listo para enviar a bodega», o el motivo y el tiempo detenido).
export default function BatchCard({ batch, onPress }) {
  const state = batchState(batch);
  const target = batch.targetQuantity;
  const produced = batch.producedQuantity || 0;
  const done = batch.status === "Completado";

  let note = null;
  if (state === "Por enviar") {
    note = { text: "Listo para enviar a bodega", color: tones.green.text };
  } else if (state === "Detenido") {
    note = {
      text: [batch.stopReason || "Detenido", batch.stoppedAt ? formatAge(batch.stoppedAt) : null].filter(Boolean).join(" · "),
      color: tones.rose.text,
    };
  } else if (state === "En bodega" && batch.destinationWarehouse) {
    note = { text: `En ${batch.destinationWarehouse}`, color: colors.muted };
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.number}>{batch.batchNumber}</Text>
        <Pill label={state} tone={statusTone(state, "lote")} />
      </View>
      <View style={[styles.row, styles.product]}>
        <ColorSwatch color={batch.color} />
        <Text style={styles.productText} numberOfLines={1}>
          {[batch.product, batch.color].filter(Boolean).join(" · ") || "—"}
          <Text style={styles.line}> · {batch.productionLine || "Sin línea"}</Text>
        </Text>
      </View>
      <View style={[styles.row, styles.progress]}>
        <LevelMeter
          value={produced}
          max={target || 0}
          tone={done ? "green" : state === "Detenido" ? "rose" : "blue"}
          style={styles.meter}
        />
        <Text style={styles.quantities}>
          {done || produced ? formatNumber(produced) : "0"} / {target != null ? formatNumber(target) : "—"}
        </Text>
      </View>
      {note ? <Text style={[styles.note, { color: note.color }]}>{note.text}</Text> : null}
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
    marginBottom: 10,
  },
  pressed: { backgroundColor: colors.surface2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  product: { marginTop: 6 },
  productText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  line: { color: colors.faint },
  progress: { marginTop: 12, gap: 12 },
  meter: { flex: 1 },
  quantities: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  note: { marginTop: 10, fontFamily: fonts.semibold, fontSize: 12.5 },
});
