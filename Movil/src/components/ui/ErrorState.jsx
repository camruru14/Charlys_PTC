import { StyleSheet, Text, View } from "react-native";
import CustomButton from "./CustomButton";
import { colors } from "../../lib/theme";

// Mensaje de error legible (ej. backend apagado) en vez de una pantalla en
// blanco o que la app truene. `onRetry` reintenta la carga (además del
// pull-to-refresh, útil para cuando ni siquiera hay datos previos que ver).
export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>No se pudo cargar la información</Text>
      <Text style={styles.text}>
        {message || "Revisá tu conexión o intentá de nuevo en un momento."}
      </Text>
      {onRetry ? (
        <View style={styles.button}>
          <CustomButton title="Reintentar" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  icon: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerSoftBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.danger,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  text: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: "center",
  },
  button: {
    marginTop: 12,
    minWidth: 160,
  },
});
