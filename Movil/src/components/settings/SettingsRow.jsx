import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Cuadro canvas de 36 con el ícono de una fila de Configuración.
export function RowIcon({ icon }) {
  return (
    <View style={styles.iconBox}>
      <Icon name={icon} size={18} color={colors.ink2} />
    </View>
  );
}

// Fila de una sección de Configuración (dentro de un ListGroup): ícono,
// título, descripción, contador opcional y chevron.
export default function SettingsRow({ icon, title, description, count, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <RowIcon icon={icon} />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {count != null ? <Text style={styles.count}>{count}</Text> : null}
      <Icon name="chevronRight" size={18} color={colors.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 11 },
  pressed: { backgroundColor: colors.surface2 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  description: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, fontVariant: ["tabular-nums"] },
});
