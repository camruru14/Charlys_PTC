import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Spinner + texto de carga mostrado mientras `loading` es true la primera
// vez (antes de tener ningún dato todavía) — mismo componente en toda la
// app, para que cada pantalla se sienta igual mientras carga.
export default function LoadingState({ label = "Cargando…" }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand600} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.background,
  },
  text: {
    fontSize: 13,
    color: colors.slate500,
  },
});
