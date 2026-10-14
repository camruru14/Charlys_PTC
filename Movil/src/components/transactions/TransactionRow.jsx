import { Pressable, StyleSheet, Text, View } from "react-native";
import UnseenMark from "../ui/UnseenMark";
import CategoryAvatar from "../finance/CategoryAvatar";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { dueText, money } from "../../lib/finance";
import { statusTone } from "../../lib/statusTones";
import { statusLabel } from "../../lib/transactionFilters";

// Fila de un movimiento manual del libro de Finanzas (para ir dentro de un
// ListGroup): avatar de la categoría, concepto (con un clip si tiene factura),
// «Categoría · Método» —o cuándo vence si está pendiente— y el monto con
// signo; si falta pagar o cobrar, su etiqueta («por pagar», «vencido»…).
// Tocarla la edita; mantenerla presionada abre sus acciones.
export default function TransactionRow({ transaction: t, category, now = new Date(), unseen, onPress, onLongPress }) {
  const income = t.type === "Ingreso";
  const label = statusLabel(t, now);
  const due = dueText(t, now);
  const meta = [t.category || "—", t.paymentMethod].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.concept || "Movimiento"}, ${income ? "ingreso" : "gasto"} de ${money(Number(t.amount) || 0)}, ${label}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <UnseenMark show={unseen} dotTop={29} />
      {income ? <CategoryAvatar name="dollar" color="green" /> : <CategoryAvatar icon={category?.icon} color={category?.color} />}
      <View style={styles.texts}>
        <View style={styles.conceptLine}>
          <Text style={[styles.concept, unseen && styles.bold]} numberOfLines={1}>
            {t.concept || "—"}
          </Text>
          {t.attachment?.url ? <Icon name="paperclip" size={13} color={colors.faint} /> : null}
        </View>
        <Text style={[styles.meta, due?.overdue && styles.overdue]} numberOfLines={1}>
          {due ? `${t.category || "—"} · ${due.text}` : meta}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, income && { color: tones.green.text }]}>
          {income ? "+" : "−"}
          {money(Math.abs(Number(t.amount) || 0))}
        </Text>
        {label !== "Pagado" ? <Pill label={label.toLowerCase()} tone={statusTone(label, "movimiento")} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15, paddingVertical: 10 },
  pressed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 2 },
  conceptLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  concept: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  bold: { fontFamily: fonts.bold },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  overdue: { fontFamily: fonts.semibold, color: tones.rose.text },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
});
