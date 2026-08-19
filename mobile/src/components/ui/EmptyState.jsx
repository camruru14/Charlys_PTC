import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Estado vacío genérico ("No hay X todavía"), usado como ListEmptyComponent
// de los FlatList/SectionList de cada pantalla — mismo ícono simple (un
// cuadro vacío) en todas, para que ninguna sección se sienta distinta de
// las demás al no tener datos todavía.
export default function EmptyState({ message }) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <View style={styles.iconBox} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  icon: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: colors.neutralSoftBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    height: 16,
    width: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.slate400,
  },
  text: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: "center",
  },
});
