import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatMoney, formatNumber } from "../../lib/format";
import { PRODUCT_COLOR_HEX, catalogStatus } from "../../lib/catalogOptions";
import { statusTone } from "../../lib/statusTones";

// Tarjeta de la cuadrícula del Catálogo (ProductCatalogCard.jsx de la web):
// foto principal con el estado en la tienda, nombre, mínimo y existencia,
// precio (con el anterior tachado si hay oferta) y los colores. Tocarla (o
// mantenerla presionada) abre las acciones del producto.
export default function ProductCard({ product, onPress, uploading = false, style }) {
  const image = product.images?.[0]?.url;
  const status = catalogStatus(product);
  const productColors = product.colors || [];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="image" size={24} color={colors.faint} />
          </View>
        )}
        <Pill label={status} tone={statusTone(status, "catalogo")} style={styles.pill} />
        {uploading ? (
          <View style={styles.uploading}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {/* El nombre del producto ES su subcategoría: solo se muestra aparte si
            falta (producto anterior) o si el nombre guardado es otro. */}
        {!product.subcategory || product.subcategory !== product.name ? (
          <Text style={product.subcategory ? styles.sub : styles.meta} numberOfLines={1}>
            {product.subcategory || "Sin subcategoría"}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          Mín. {formatNumber(product.minOrderQuantity ?? 1)} · {formatNumber(product.stock ?? 0)}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMoney(product.price)}</Text>
          {product.compareAtPrice ? <Text style={styles.before}>{formatMoney(product.compareAtPrice)}</Text> : null}
        </View>
        {productColors.length ? (
          <View style={styles.dots}>
            {productColors.map((c) => (
              <View key={c} style={[styles.dot, { backgroundColor: PRODUCT_COLOR_HEX[c] || colors.lineSoft }]} />
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>Sin colores</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85 },
  imageWrap: { height: 118, backgroundColor: colors.canvas },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", top: 8, right: 8 },
  uploading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backdrop,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 11, paddingTop: 9, paddingBottom: 11, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.primary },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ["tabular-nums"] },
  before: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.subtle,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.line },
});
