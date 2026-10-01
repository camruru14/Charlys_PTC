import { StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import Icon from "./Icon";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Mensaje de error legible (ej. backend apagado) en vez de una pantalla en
// blanco o que la app truene. `onRetry` reintenta la carga (además del
// pull-to-refresh, útil para cuando ni siquiera hay datos previos que ver).
export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Icon name="alert" size={22} color={tones.rose.dot} />
      </View>
      <Text style={styles.title}>No se pudo cargar la información</Text>
      <Text style={styles.text}>
        {message || "Revisa tu conexión o intenta de nuevo en un momento."}
      </Text>
      {onRetry ? (
        <Button title="Reintentar" onPress={onRetry} variant="secondary" style={styles.button} />
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
    backgroundColor: colors.canvas,
  },
  icon: {
    height: 48,
    width: 48,
    borderRadius: 14,
    backgroundColor: tones.rose.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    textAlign: "center",
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  button: {
    marginTop: 12,
    minWidth: 160,
  },
});
