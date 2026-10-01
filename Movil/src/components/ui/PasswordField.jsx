import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";
import { FieldLabel, fieldStyles } from "./fieldStyles";

// Campo de contraseña con el botón de ojo para mostrarla u ocultarla
// (PasswordField de la web). `note` va debajo, en muted (o `noteColor`).
export default function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  editable = true,
  note,
  noteColor,
  style,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[fieldStyles.field, style]}>
      <FieldLabel label={label} required={required} />
      <View style={[fieldStyles.box, !editable && fieldStyles.boxDisabled]}>
        <TextInput
          style={[fieldStyles.value, styles.input]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          accessibilityLabel={label || placeholder}
          {...inputProps}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {/* El ícono muestra el estado: tachado = oculta, abierto = visible. */}
          <Icon name={visible ? "eye" : "eyeOff"} size={18} color={colors.muted} />
        </Pressable>
      </View>
      {note ? <Text style={[styles.note, noteColor && { color: noteColor }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, alignSelf: "stretch", paddingVertical: 0 },
  note: { marginTop: 6, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.muted },
});
