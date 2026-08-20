import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../../lib/theme";

// Botón flotante "+" (esquina inferior derecha) que cada pantalla de lista
// de la Fase 3 usa para navegar a su formulario de creación.
export default function FloatingAddButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.icon}>+</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  icon: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "600",
    marginTop: -2,
  },
});
