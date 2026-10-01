import { StyleSheet, View } from "react-native";
import { colors } from "../../lib/theme";

// Tarjeta base de la app: superficie blanca, borde `line`, radio 16 y sin
// sombra (igual que las tarjetas del panel web). Las tarjetas de
// components/<dominio>/ la usan por dentro.
export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
});
