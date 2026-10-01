import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Píldoras de selección (motorista, vehículo), como PillSelector de la web.
// options = [{ value, label, busy }]: las ocupadas llevan « · en ruta», van
// apagadas con borde punteado y no se pueden tocar.
export default function PillSelector({ options, value, onChange, disabled = false }) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        if (o.busy) {
          return (
            <View key={o.value} style={[styles.pill, styles.busy]} accessibilityState={{ disabled: true }}>
              <Text style={[styles.text, styles.textBusy]} numberOfLines={1}>
                {o.label} · en ruta
              </Text>
            </View>
          );
        }
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            hitSlop={3}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
              styles.pill,
              selected ? styles.selected : [styles.free, pressed && styles.pressed],
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  free: { backgroundColor: colors.surface, borderColor: colors.line },
  pressed: { borderColor: colors.selectBar },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  busy: { backgroundColor: colors.busy, borderColor: colors.busyLine, borderStyle: "dashed" },
  disabled: { opacity: 0.55 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  textSelected: { color: colors.white },
  textBusy: { color: colors.faint },
});
