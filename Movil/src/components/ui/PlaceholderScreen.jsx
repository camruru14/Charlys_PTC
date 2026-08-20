import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Pantalla placeholder compartida por los módulos que todavía no se
// implementan (Fase 1: solo scaffolding + login + navegación). Cada
// pantalla real (Fase 2+) reemplaza esto por su propia lista/dashboard.
export default function PlaceholderScreen({ title }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Esta sección se implementa en una fase posterior
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: "center",
  },
});
