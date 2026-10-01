import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Campo de búsqueda de las listas: 42 de alto, ícono de lupa a la izquierda
// y botón para limpiar cuando hay texto.
export default function SearchField({ value, onChangeText, placeholder = "Buscar", style, ...inputProps }) {
  return (
    <View style={[styles.box, style]}>
      <Icon name="search" size={18} color={colors.faint} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        {...inputProps}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
          <Icon name="close" size={16} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
});
