import { Pressable, StyleSheet, Text, View } from "react-native";
import UnseenMark from "../ui/UnseenMark";
import CategoryAvatar from "../finance/CategoryAvatar";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { money, plural } from "../../lib/finance";

// Fila de las ventas de la tienda de un día (una sola por día): «Ventas de la
// tienda» con la etiqueta «automático», cuántos pedidos y el total en verde.
// Tocarla abre el detalle de solo lectura del día.
export default function SalesRow({ sales, unseen, onPress }) {
  const total = sales.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ventas de la tienda, ${plural(sales.length, "pedido", "pedidos")}, ${money(total)}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <UnseenMark show={unseen} dotTop={29} />
      <CategoryAvatar name="orders" color="green" />
      <View style={styles.texts}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, unseen && styles.bold]} numberOfLines={1}>
            Ventas de la tienda
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>automático</Text>
          </View>
        </View>
        <Text style={styles.meta}>{plural(sales.length, "pedido", "pedidos")}</Text>
      </View>
      <Text style={styles.amount}>+{money(total)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15, paddingVertical: 10 },
  pressed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 2 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  bold: { fontFamily: fonts.bold },
  tag: { backgroundColor: tones.green.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: tones.green.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: tones.green.text, fontVariant: ["tabular-nums"] },
});
