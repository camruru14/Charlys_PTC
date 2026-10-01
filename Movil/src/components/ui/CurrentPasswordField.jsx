import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";
import { FieldLabel, INPUT_HEIGHT } from "./fieldStyles";
import { useToast } from "./Toast";

// «Contraseña actual» de Mi cuenta (CurrentPasswordField de la web): fija,
// de solo lectura, con el ojo para mostrarla u ocultarla. `password` es la
// que se puede mostrar (la del backend o, si es un hash viejo, la de esta
// sesión); `legacy` indica ese hash viejo. Nunca se guarda: solo se pinta.
// Al salir de la pantalla vuelve a quedar oculta.
export default function CurrentPasswordField({ password, legacy = false, style }) {
  const toast = useToast();
  const [visible, setVisible] = useState(false);

  useFocusEffect(useCallback(() => () => setVisible(false), []));

  const shown = visible && password ? password : "•".repeat(password ? Math.min(password.length, 16) : 8);

  const toggle = () => {
    if (!password) {
      toast.show(
        legacy
          ? "Tu contraseña no se puede mostrar hasta que se actualice: escribe una nueva en «Cambiar contraseña» para reemplazarla."
          : "Todavía no se pudo cargar tu contraseña. Intenta de nuevo en un momento.",
      );
      return;
    }
    setVisible((v) => !v);
  };

  return (
    <View style={[styles.field, style]}>
      <FieldLabel label="Contraseña actual" />
      <View style={styles.box}>
        <Text
          style={styles.value}
          numberOfLines={1}
          selectable={false}
          accessibilityLabel={visible && password ? "Contraseña actual visible" : "Contraseña actual oculta"}
        >
          {shown}
        </Text>
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          accessibilityState={{ selected: visible }}
          style={styles.eye}
        >
          {/* El ícono muestra el estado: tachado = oculta, abierto = visible. */}
          <Icon name={visible ? "eye" : "eyeOff"} size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  box: {
    minHeight: INPUT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    paddingLeft: 14,
  },
  value: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  eye: { width: 44, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
});
