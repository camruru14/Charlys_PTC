import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import { colors } from "../../lib/theme";

// Tarjeta de KPI del Dashboard (grid de 2 columnas). Mismos labels que
// KpiCard.jsx del panel web. `hint` (nuevo) es un subtítulo chico debajo del
// valor — equivalente simplificado (texto plano, sin el "pill" de color) del
// `trend.label` de KpiCard.jsx en el panel web.
export default function KpiTile({ label, value, hint }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.slate500,
  },
  value: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  hint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand700,
  },
});
