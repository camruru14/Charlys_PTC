import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";
import { formatCurrency } from "../../lib/format";

const MAX_IMAGES_PER_UPLOAD = 6;

// Tarjeta de un producto del catálogo público (administrado por empleados).
// El botón de "+ Foto" es un TouchableOpacity separado del que envuelve toda
// la card en CatalogoScreen.jsx (el que navega a editar) — al estar
// anidados, React Native le asigna el toque solo al más interno, así que no
// dispara la navegación además de la subida.
export default function ProductCard({ product, onAddImages, uploading = false }) {
  const image = product.images?.[0]?.url;
  const colorChips = product.colors || [];
  const extraImages = (product.images?.length || 0) - 1;

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", "Se necesita acceso a la galería para elegir imágenes");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES_PER_UPLOAD,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const files = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `imagen-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || "image/jpeg",
    }));

    onAddImages?.(product, files);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.imageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>IC</Text>
            </View>
          )}
          {extraImages > 0 ? (
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>+{extraImages}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handlePickImages}
            disabled={uploading}
            activeOpacity={0.8}
            hitSlop={6}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.addPhotoIcon}>+</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>
            {product.active === false ? <Badge label="Inactivo" tone="red" /> : null}
          </View>

          <Text style={styles.category}>{product.category}</Text>

          {colorChips.length > 0 ? (
            <View style={styles.chips}>
              {colorChips.map((color) => (
                <View key={color} style={styles.chip}>
                  <Text style={styles.chipText}>{color}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noColors}>Sin colores</Text>
          )}

          <View style={styles.footer}>
            <View style={styles.priceGroup}>
              <Text style={styles.price}>{formatCurrency(product.price)}</Text>
              {product.compareAtPrice ? (
                <Text style={styles.comparePrice}>{formatCurrency(product.compareAtPrice)}</Text>
              ) : null}
            </View>
            <Text style={styles.stock}>Stock: {product.stock ?? 0}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  imageWrap: {
    width: 64,
    height: 64,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.slate200,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.slate500,
  },
  imageCountBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
  },
  imageCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  addPhotoButton: {
    position: "absolute",
    top: -6,
    right: -6,
    height: 22,
    width: 22,
    borderRadius: 11,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoIcon: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  category: {
    marginTop: 2,
    fontSize: 12,
    color: colors.slate500,
  },
  chips: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  chipText: {
    fontSize: 10,
    color: colors.slate700,
    fontWeight: "600",
  },
  noColors: {
    marginTop: 6,
    fontSize: 11,
    color: colors.slate400,
  },
  footer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand700,
  },
  comparePrice: {
    fontSize: 11,
    color: colors.slate400,
    textDecorationLine: "line-through",
  },
  stock: {
    fontSize: 12,
    color: colors.slate500,
  },
});
