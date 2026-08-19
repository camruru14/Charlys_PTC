import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Fila de alerta del Dashboard (stock bajo, lote detenido, etc.), con un
// acento de color según `tone`: "red" -> rojo, cualquier otra cosa (ej.
// "yellow") -> ámbar.
export default function AlertCard({ alert }) {
  const isRed = alert.tone === "red";

  return (
    <View style={[styles.container, { backgroundColor: isRed ? colors.dangerSoftBg : colors.warningSoftBg }]}>
      <View style={[styles.dot, { backgroundColor: isRed ? colors.danger : colors.warningSoftText }]} />
      <View style={styles.texts}>
        <Text style={styles.text}>{alert.text}</Text>
        {alert.meta ? <Text style={styles.meta}>{alert.meta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  texts: {
    flex: 1,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.slate500,
  },
});
