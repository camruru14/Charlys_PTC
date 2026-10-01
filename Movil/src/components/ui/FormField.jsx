import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../lib/theme";
import { FieldLabel, fieldStyles } from "./fieldStyles";

// Campo de texto/numérico genérico de los formularios: un `useState` por
// campo (o un objeto de estado + handleChange), sin librería de formularios.
// `suffix` muestra una unidad a la derecha ("u", "kg"). El resto de props
// (maxLength, onBlur, returnKeyType...) pasan directo al TextInput.
export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  secureTextEntry = false,
  autoCapitalize = "sentences",
  editable = true,
  required = false,
  suffix,
  style,
  ...inputProps
}) {
  return (
    <View style={[fieldStyles.field, style]}>
      <FieldLabel label={label} required={required} />
      <View style={[fieldStyles.box, multiline && styles.multilineBox, !editable && fieldStyles.boxDisabled]}>
        <TextInput
          style={[fieldStyles.value, styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          accessibilityLabel={label || placeholder}
          {...inputProps}
        />
        {suffix ? <Text style={fieldStyles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    alignSelf: "stretch",
    paddingVertical: 0,
  },
  multilineBox: {
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
});
