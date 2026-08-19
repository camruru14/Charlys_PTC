import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";
import { formatCurrency } from "../../lib/format";

// Una línea de un pedido, con los botones de acción que correspondan a su
// estado ACTUAL — nunca se muestra un botón para una acción que no aplica
// en ese momento (ver PARTE 1 de la Fase 4):
//   1. Pedido sin `inventoryRequestedAt`: sin botones todavía.
//   2. Línea empacada: badge "Empacado ✓", listo.
//   3. Con lote de fabricación sin completar: solo texto informativo.
//   4. Con lote de fabricación completado y sin empacar: "Empacar (de
//      fabricación)".
//   5. Enviada a fabricación sin lote todavía: "Fabricar".
//   6. Verificada sin empacar: "Empacar".
//   7. Nada de lo anterior: "Verificar" + "Enviar a fabricación".
export default function OrderItemCard({
  item,
  requested,
  busy,
  onVerify,
  onSendToManufacturing,
  onPack,
  onManufacture,
  onPackManufactured,
}) {
  const batch = item.manufacturingBatch;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.product} numberOfLines={1}>
          {item.product}
          {item.color ? ` · ${item.color}` : ""}
        </Text>
        <Text style={styles.subtotal}>{formatCurrency(item.subtotal)}</Text>
      </View>
      <Text style={styles.meta}>
        {item.quantity} unidad{item.quantity === 1 ? "" : "es"} · {formatCurrency(item.unitPrice)} c/u
      </Text>

      {!requested ? null : item.packed ? (
        <View style={styles.actions}>
          <Badge label="Empacado ✓" tone="green" />
        </View>
      ) : batch && batch.status !== "Completado" ? (
        <Text style={styles.info}>
          Fabricando — lote {batch.batchNumber} ({batch.status})
        </Text>
      ) : batch && batch.status === "Completado" ? (
        <View style={styles.actions}>
          <MiniButton label="Empacar (de fabricación)" onPress={onPackManufactured} loading={busy} />
        </View>
      ) : item.sentToManufacturing ? (
        <View style={styles.actions}>
          <MiniButton label="Fabricar" onPress={onManufacture} loading={busy} />
        </View>
      ) : item.verified ? (
        <View style={styles.actions}>
          <MiniButton label="Empacar" onPress={onPack} loading={busy} />
        </View>
      ) : (
        <View style={styles.actions}>
          <MiniButton label="Verificar" onPress={onVerify} loading={busy} />
          <MiniButton label="Enviar a fabricación" variant="neutral" onPress={onSendToManufacturing} loading={busy} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  product: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  subtotal: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand700,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.slate500,
  },
  info: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: colors.slate500,
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
