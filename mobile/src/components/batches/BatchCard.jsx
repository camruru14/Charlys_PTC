import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";
import { batchStatusTone } from "../../lib/statusTones";

// Tarjeta de un lote de fabricación. `compact` la achica para reutilizarla
// en "Lotes recientes" del Dashboard (mismo mapeo de color de status que
// FabricacionScreen, vía lib/statusTones.js). `onReport`/`onUndoReport`
// (Fase 4) muestran el botón "Reportar" (o "Reportado ✓" si el lote ya
// tiene `lastReportedAt`) — se omiten (ej. en el Dashboard) para no
// reportar producción desde ahí.
export default function BatchCard({ batch, compact = false, onReport, onUndoReport, reporting = false }) {
  const produced = Number(batch.producedQuantity || 0);
  const target = Number(batch.targetQuantity || 0);
  const reported = Boolean(batch.lastReportedAt);

  return (
    <Card style={compact ? styles.cardCompact : undefined}>
      <View style={styles.header}>
        <Text style={styles.batchNumber} numberOfLines={1}>
          {batch.batchNumber}
        </Text>
        <Badge label={batch.status} tone={batchStatusTone(batch.status)} />
      </View>

      <Text style={styles.product} numberOfLines={1}>
        {batch.product}
        {batch.color ? ` · ${batch.color}` : ""}
      </Text>

      {!compact ? (
        <Text style={styles.quantity}>
          {produced.toLocaleString("es-SV")} / {target.toLocaleString("es-SV")} unidades
        </Text>
      ) : null}

      {!compact && (onReport || onUndoReport) ? (
        <View style={styles.reportRow}>
          <MiniButton
            label={reported ? "Reportado ✓" : "Reportar"}
            variant={reported ? "success" : "primary"}
            onPress={reported ? onUndoReport : onReport}
            loading={reporting}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardCompact: {
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  product: {
    marginTop: 4,
    fontSize: 13,
    color: colors.slate700,
  },
  quantity: {
    marginTop: 6,
    fontSize: 12,
    color: colors.slate500,
  },
  reportRow: {
    marginTop: 10,
    alignItems: "flex-start",
  },
});
