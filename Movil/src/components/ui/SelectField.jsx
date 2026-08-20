import { useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";

// Selector genérico de una opción entre una lista, con un modal simple.
// `label` es opcional (si no se pasa, no ocupa espacio arriba — útil para
// usarlo como filtro compacto, ver Dashboard); `title` es el encabezado del
// modal y por defecto usa `label`.
export default function SelectField({
  label,
  title,
  value,
  options,
  onChange,
  required = false,
  placeholder = "Seleccionar",
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const heading = title || label;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.input} onPress={() => setOpen(true)} activeOpacity={0.8} hitSlop={4}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {heading ? <Text style={styles.sheetTitle}>{heading}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={item.value === value ? styles.optionSelected : styles.optionText}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No hay opciones</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.slate700, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  value: { fontSize: 15, color: colors.text },
  placeholder: { fontSize: 15, color: colors.slate400 },
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 15, fontWeight: "800", color: colors.text, paddingHorizontal: 20, marginBottom: 8 },
  option: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.slate100 },
  optionText: { fontSize: 15, color: colors.text },
  optionSelected: { fontSize: 15, color: colors.brand600, fontWeight: "700" },
  empty: { paddingHorizontal: 20, paddingVertical: 14, fontSize: 13, color: colors.slate500 },
});
