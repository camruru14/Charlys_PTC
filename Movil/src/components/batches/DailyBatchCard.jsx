import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";
import { formatDate } from "../../lib/format";

// Tarjeta simple de un lote diario (programación previa, sin status ni
// cantidades todavía — eso se define al pasar a Fabricación). `onSchedule`
// (Fase 3) muestra el botón "Programar" (PATCH /dailyBatches/:id/schedule),
// que convierte este lote diario en un lote de fabricación.
export default function DailyBatchCard({ dailyBatch, onSchedule, scheduling = false }) {
  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.number} numberOfLines={1}>
          {dailyBatch.dailyBatchNumber}
        </Text>
        <Text style={styles.date}>{formatDate(dailyBatch.date)}</Text>
      </View>
      <Text style={styles.product} numberOfLines={1}>
        {dailyBatch.product}
        {dailyBatch.color ? ` · ${dailyBatch.color}` : ""}
      </Text>

      {onSchedule ? (
        <View style={styles.scheduleRow}>
          <MiniButton label="Programar" onPress={onSchedule} loading={scheduling} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  number: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  date: {
    fontSize: 12,
    color: colors.slate500,
  },
  product: {
    marginTop: 4,
    fontSize: 13,
    color: colors.slate700,
  },
  scheduleRow: {
    marginTop: 10,
    alignItems: "flex-start",
  },
});
