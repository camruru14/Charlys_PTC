import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Encabezado de grupo de una lista agrupada (SectionList): nombre, nota en
// gris y cuántos hay. Lo usan Inventario > Pedidos y Fabricación > Lotes.
//   renderSectionHeader={({ section }) => (
//     <GroupHeader title={section.title} note={section.note} count={section.count} />
//   )}
export default function GroupHeader({ title, note, count }) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBox}>
        <Text style={styles.title}>{title}</Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            · {note}
          </Text>
        ) : null}
      </View>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: colors.canvas,
  },
  titleBox: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 6 },
  title: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.subtle },
  note: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.faint },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
