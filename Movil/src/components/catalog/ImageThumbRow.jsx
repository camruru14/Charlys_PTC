import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

const SIZE = 84;

function Thumb({ uri, onRemove, removing, pending }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri }} style={[styles.thumb, pending && styles.pending]} />
      {pending ? (
        <View style={styles.pendingTag}>
          <Text style={styles.pendingText}>Al guardar</Text>
        </View>
      ) : null}
      <Pressable
        style={styles.remove}
        onPress={onRemove}
        disabled={removing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Quitar imagen"
      >
        {removing ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Icon name="close" size={13} color={colors.white} />
        )}
      </Pressable>
    </View>
  );
}

// Fila de miniaturas de las fotos del producto (84×84):
//   - `images`: ya subidas; la «x» las borra de Cloudinary (DELETE
//     /products/:id/images/:publicId), como en la web.
//   - `pending`: elegidas y todavía sin subir (se suben al guardar); la «x»
//     solo las saca de la cola.
// Al final, el cuadro punteado «+ Foto» (`onAdd`).
export default function ImageThumbRow({ images = [], pending = [], onRemove, onRemovePending, removingId, onAdd }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {images.map((img) => (
        <Thumb
          key={img.publicId}
          uri={img.url}
          removing={removingId === img.publicId}
          onRemove={() => onRemove(img.publicId)}
        />
      ))}
      {pending.map((file, index) => (
        <Thumb key={file.uri} uri={file.uri} pending onRemove={() => onRemovePending(index)} />
      ))}
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Agregar foto"
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        >
          <Icon name="plus" size={18} color={colors.faint} />
          <Text style={styles.addText}>Foto</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginHorizontal: -20, marginBottom: 16 },
  row: { gap: 10, paddingHorizontal: 20, paddingTop: 6 },
  thumbWrap: { width: SIZE, height: SIZE },
  thumb: { width: SIZE, height: SIZE, borderRadius: 12, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  pending: { opacity: 0.75 },
  pendingTag: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingVertical: 1,
    alignItems: "center",
  },
  pendingText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.ink2 },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    width: SIZE,
    height: SIZE,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.busyLine,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  addPressed: { backgroundColor: colors.surface2 },
  addText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
});
