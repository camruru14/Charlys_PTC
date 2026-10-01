import { useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../ui/KeyboardScreen";
import BottomBar from "../ui/BottomBar";
import FormField from "../ui/FormField";
import { useToast } from "../ui/Toast";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Formulario de un solo campo para agregar una bodega, un vehículo o una
// línea de producción (EntityModal y LineModal de la web): el valor se manda
// sin espacios de más y los errores del backend (p. ej. duplicado) se
// muestran tal cual.
//   onSubmit(value) crea el registro; successMessage(value) es el Toast.
export default function SingleFieldForm({
  navigation,
  title,
  label,
  placeholder,
  emptyMessage,
  note,
  autoCapitalize = "sentences",
  onSubmit,
  successMessage,
}) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return Alert.alert("Falta información", emptyMessage);
    setSaving(true);
    try {
      await onSubmit(trimmed);
      toast.show(successMessage(trimmed));
      navigation.goBack();
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <FormField
          label={label}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          autoCapitalize={autoCapitalize}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
          required
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </KeyboardScreen>
      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          { title: "Agregar", loading: saving, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
});
