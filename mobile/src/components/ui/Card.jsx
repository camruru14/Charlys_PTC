import { StyleSheet, View } from "react-native";
import { colors } from "../../lib/theme";

// Componente base reutilizable para las tarjetas de cada dominio (lotes,
// transacciones, productos, etc.): fondo blanco, bordes redondeados y
// sombra/elevation, al estilo de CustomCard.jsx del proyecto de referencia.
// Las tarjetas de components/<dominio>/ lo usan por dentro para no repetir
// el mismo shadow/borderRadius en cada archivo.
export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
