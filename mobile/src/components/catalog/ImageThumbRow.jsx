import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";

// Fila de miniaturas de las imágenes ya subidas (solo en modo edición, ver
// ProductoFormScreen), cada una con una "x" chiquita que borra la imagen de
// Cloudinary vía DELETE /products/:id/images/:publicId.
export default function ImageThumbRow({ images, onRemove, removingId }) {
  if (!images?.length) return null;

  return (
    <View style={styles.row}>
      {images.map((img) => (
        <View key={img.publicId} style={styles.thumbWrap}>
          <Image source={{ uri: img.url }} style={styles.thumb} />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(img.publicId)}
            disabled={removingId === img.publicId}
            hitSlop={6}
          >
            {removingId === img.publicId ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.removeText}>×</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thumbWrap: {
    width: 72,
    height: 72,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.slate200,
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    height: 22,
    width: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
});
