import { StyleSheet, Text } from "react-native";
import Card from "../ui/Card";
import { colors } from "../../lib/theme";

// Tarjeta mínima para las listas de Logística (placas de vehículos,
// nombres de bodegas): la asignación de entregas es lo más rico de este
// módulo en la web y se implementa junto con Pedidos en una fase posterior.
export default function SimpleListCard({ label }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
});
