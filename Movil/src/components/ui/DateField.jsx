import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "../../lib/theme";
import Icon from "./Icon";
import { FieldLabel, fieldStyles } from "./fieldStyles";

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// mode="date": value es "yyyy-mm-dd".
// mode="time" (Entrada/Salida de "Registrar marcación"): value es "HH:mm" en
// 24 horas. Ambos casos evitan `new Date(string)` para no correr fecha/hora
// en husos horarios detrás de UTC.
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
  style,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const placeholder = mode === "time" ? "Seleccionar hora" : "Seleccionar fecha";

  const handleChange = (event, selectedDate) => {
    // Android cierra el picker solo al elegir/cancelar; iOS lo deja inline.
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) onChange(toInputValue(selectedDate, mode));
  };

  return (
    <View style={[fieldStyles.field, style]}>
      <FieldLabel label={label} required={required} />
      <Pressable
        style={({ pressed }) => [fieldStyles.box, pressed && { backgroundColor: colors.surface2 }]}
        onPress={() => setShowPicker(true)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${label || placeholder}: ${value ? displayValue(value, mode) : "sin seleccionar"}`}
      >
        <Text style={value ? fieldStyles.value : fieldStyles.placeholder}>
          {value ? displayValue(value, mode) : placeholder}
        </Text>
        <Icon name="calendar" size={18} color={colors.faint} />
      </Pressable>

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
