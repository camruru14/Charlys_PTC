import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUnseen } from "../../hooks/useActivity";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// «Marcar todo como visto»: enlace pequeño para arriba de una lista. Solo
// aparece si la pestaña `activityKey` (p. ej. «fabricacion.pedidos») tiene
// novedades. Va en su propia línea, alineado a la derecha.
export default function MarkAllSeen({ activityKey, style }) {
  const { count, markAll } = useUnseen(activityKey);
  if (count <= 0) return null;
  return (
    <View style={[styles.row, style]}>
      <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button">
        <Text style={styles.text}>Marcar todo como visto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-end", marginBottom: 8 },
  text: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.primarySoftText },
});
