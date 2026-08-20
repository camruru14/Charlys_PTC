import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";
import { stockStatus, stockStatusTone } from "../../lib/inventoryStatus";
import { formatDate } from "../../lib/format";

// Tarjeta de un artículo de inventario (materia prima, producto terminado o
// lote reportado). `onSend`/`onDeleteReport` (Fase 8) son solo para lotes
// reportados (con batchNumber): "Enviar" a Artículos en almacén o "Eliminar"
// el reporte (el lote en Fabricación no se toca en ningún caso).
export default function InventoryCard({ item, onSend, sending = false, onDeleteReport, deletingReport = false }) {
  const status = stockStatus(item);
  const isReportedBatch = Boolean(item.batchNumber);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
          {item.color ? ` · ${item.color}` : ""}
        </Text>
        <Badge label={item.category} tone={item.category === "Producto Terminado" ? "blue" : "gray"} />
      </View>

      {isReportedBatch ? <Text style={styles.batchNumber}>Lote {item.batchNumber}</Text> : null}

      <View style={styles.statsRow}>
        <Text style={styles.stock}>
          {Number(item.stock || 0).toLocaleString("es-SV")} {item.unit}
        </Text>
        <Badge label={status} tone={stockStatusTone(status)} />
      </View>

      {item.materialType ? <Text style={styles.meta}>{item.materialType}</Text> : null}
      {item.location ? <Text style={styles.meta}>{item.location}</Text> : null}
      {isReportedBatch ? <Text style={styles.meta}>Reportado {formatDate(item.updatedAt)}</Text> : null}

      {isReportedBatch ? (
        <View style={styles.actionsRow}>
          {item.sentToWarehouse ? (
            <Badge label="Enviado" tone="green" />
          ) : (
            <MiniButton label="Enviar" onPress={onSend} loading={sending} />
          )}
          {onDeleteReport ? (
            <MiniButton label="Eliminar" variant="neutral" onPress={onDeleteReport} loading={deletingReport} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  batchNumber: { marginTop: 4, fontSize: 12, fontWeight: "700", color: colors.slate700 },
  statsRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stock: { fontSize: 13, fontWeight: "600", color: colors.slate700 },
  meta: { marginTop: 4, fontSize: 12, color: colors.slate500 },
  actionsRow: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "flex-start" },
});
