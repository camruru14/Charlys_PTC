import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Estado vacío genérico ("No hay X todavía"), usado como ListEmptyComponent
// de los FlatList/SectionList de cada pantalla. `title` e `icon` son
// opcionales; por defecto, una caja.
export default function EmptyState({ message, title, icon = "box" }) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Icon name={icon} size={22} color={colors.faint} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
  },
  icon: {
    height: 48,
    width: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
});
