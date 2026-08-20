import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateField from "./DateField";
import { useDateRange, rangeLabel } from "../../context/DateRangeContext";
import { colors } from "../../lib/theme";

// Date -> "yyyy-mm-dd" para precargar los DateField del rango personalizado.
function toInputValue(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Botón compacto de header (Dashboard/Fabricación/Finanzas/Historiales) que
// abre el selector de rango de fechas global.
export default function DateRangeButton() {
  const range = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toInputValue(range.from));
  const [to, setTo] = useState(toInputValue(range.to));

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

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={styles.buttonText} numberOfLines={1}>
          {rangeLabel(range)}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Rango de fechas</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.groupLabel}>Rangos rápidos</Text>
              <View style={styles.presetRow}>
                {Object.entries(range.presets).map(([key, p]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.presetPill, range.preset === key && styles.presetPillActive]}
                    onPress={() => {
                      range.setPreset(key);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.presetText, range.preset === key && styles.presetTextActive]}>
                      {p.label.replace("Últimos ", "")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.divider} />

              <Text style={styles.groupLabel}>Rango personalizado</Text>
              <DateField label="Desde" value={from} onChange={setFrom} />
              <DateField label="Hasta" value={to} onChange={setTo} />

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    range.reset();
                    setOpen(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.resetText}>Restablecer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyButton} onPress={applyCustom} activeOpacity={0.85}>
                  <Text style={styles.applyButtonText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.neutralSoftBg,
    maxWidth: 130,
  },
  buttonText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 14 },
  groupLabel: { fontSize: 12, fontWeight: "700", color: colors.slate500, marginBottom: 8, textTransform: "uppercase" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  presetPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.neutralSoftBg },
  presetPillActive: { backgroundColor: colors.brand600 },
  presetText: { fontSize: 13, fontWeight: "600", color: colors.slate700 },
  presetTextActive: { color: colors.white },
  divider: { height: 1, backgroundColor: colors.slate100, marginVertical: 16 },
  actionsRow: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resetText: { fontSize: 13, fontWeight: "700", color: colors.slate500 },
  applyButton: { backgroundColor: colors.brand600, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  applyButtonText: { fontSize: 13, fontWeight: "700", color: colors.white },
});
