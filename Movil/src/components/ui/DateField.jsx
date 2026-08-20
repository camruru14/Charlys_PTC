import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "../../lib/theme";

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// mode="date": value es "yyyy-mm-dd" (igual que antes, Fase 3 original).
// mode="time" (Fase 3 v2, para Entrada/Salida de "Registrar marcación"):
// value es "HH:mm" en 24 horas. Ambos casos evitan `new Date(string)` para
// no correr fecha/hora en husos horarios detrás de UTC.
function parseInputValue(value, mode) {
  const now = new Date();
  if (mode === "time") {
    if (!value) return now;
    const [h, min] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return now;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }
  if (!value) return now;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return now;
  return new Date(y, m - 1, d);
}

function toInputValue(date, mode) {
  if (mode === "time") {
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayValue(value, mode) {
  if (!value) return "";
  if (mode === "time") {
    const [h, min] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return "";
    const period = h < 12 ? "a. m." : "p. m.";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(min).padStart(2, "0")} ${period}`;
  }
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export default function DateField({
  label,
  value,
  onChange,
  required = false,
  mode = "date",
  maximumDate,
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event, selectedDate) => {
    // Android cierra el picker solo al elegir/cancelar; iOS lo deja inline.
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) onChange(toInputValue(selectedDate, mode));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.8}
        hitSlop={4}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? displayValue(value, mode) : mode === "time" ? "Seleccionar hora" : "Seleccionar fecha"}
        </Text>
      </TouchableOpacity>

      {showPicker ? (
        <DateTimePicker
          value={parseInputValue(value, mode)}
          mode={mode}
          maximumDate={maximumDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  value: {
    fontSize: 15,
    color: colors.text,
  },
  placeholder: {
    fontSize: 15,
    color: colors.slate400,
  },
});
