import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import DateField from "./DateField";
import FilterChips from "./FilterChips";
import Icon from "./Icon";
import { useDateRange, rangeLabel } from "../../context/DateRangeContext";
import { colors } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";

// Date -> "yyyy-mm-dd" para precargar los DateField del rango personalizado.
function toInputValue(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Chip del encabezado (Dashboard/Fabricación/Finanzas/Historiales) que abre
// el selector de rango de fechas global.
export default function DateRangeButton() {
  const range = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toInputValue(range.from));
  const [to, setTo] = useState(toInputValue(range.to));
  const label = rangeLabel(range);

  useEffect(() => {
    setFrom(toInputValue(range.from));
    setTo(toInputValue(range.to));
  }, [range.from, range.to]);

  const applyCustom = () => {
    if (!from || !to) return;
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T23:59:59`);
    if (f > t) return;
    range.setCustom(f, t);
    setOpen(false);
  };

  const presetOptions = Object.entries(range.presets).map(([key, p]) => ({
    value: key,
    label: p.label.replace("Últimos ", ""),
  }));

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Rango de fechas: ${label}`}
      >
        <Icon name="calendar" size={15} color={colors.faint} />
        <Text style={styles.chipText} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Rango de fechas"
        subtitle={label}
        footer={
          <View style={styles.actions}>
            <Button
              title="Restablecer"
              variant="secondary"
              style={styles.action}
              onPress={() => {
                range.reset();
                setOpen(false);
              }}
            />
            <Button title="Aplicar" style={styles.action} onPress={applyCustom} disabled={!from || !to} />
          </View>
        }
      >
        <Text style={[type.overline, styles.groupLabel]}>Rangos rápidos</Text>
        <FilterChips
          options={presetOptions}
          value={range.preset}
          onChange={(key) => {
            range.setPreset(key);
            setOpen(false);
          }}
        />

        <View style={styles.divider} />

        <Text style={[type.overline, styles.groupLabel]}>Rango personalizado</Text>
        <DateField label="Desde" value={from} onChange={setFrom} />
        <DateField label="Hasta" value={to} onChange={setTo} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipPressed: {
    backgroundColor: colors.surface2,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink,
  },
  groupLabel: {
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginVertical: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
