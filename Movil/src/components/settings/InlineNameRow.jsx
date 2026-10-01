import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { RowIcon } from "./SettingsRow";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Fila de Bodegas / Vehículos / Líneas de producción (InlineName de la web):
// tocar el nombre lo vuelve un campo con «Listo»; a la derecha, `right`
// (p. ej. una Pill) y la basura, deshabilitada con `deleteBlocked`.
//   onSave(value) guarda el nombre (async; si falla se sigue editando).
//   renameNote(value) -> texto opcional bajo el campo mientras se edita.
export default function InlineNameRow({
  icon,
  value,
  detail,
  muted = false,
  label,
  onSave,
  renameNote,
  autoCapitalize = "sentences",
  right,
  onDelete,
  deleteBlocked = false,
}) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;

  const finish = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert("Falta información", `Escribe el ${label}`);
      return;
    }
    if (trimmed === value) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setDraft(null);
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
  };

  const note = editing ? (renameNote?.(draft.trim()) || "Toca Listo para guardar") : null;

  return (
    <View style={styles.row}>
      <RowIcon icon={icon} />
      {editing ? (
        <View style={styles.texts}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={finish}
            editable={!saving}
            accessibilityLabel={label}
          />
          <Text style={styles.detail}>{note}</Text>
        </View>
      ) : (
        <Pressable
          style={styles.texts}
          onPress={() => setDraft(value)}
          accessibilityRole="button"
          accessibilityLabel={`Cambiar ${label}: ${value}`}
        >
          <Text style={[styles.name, muted && styles.muted]} numberOfLines={1}>
            {value}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </Pressable>
      )}
      {editing ? (
        <Button title="Listo" size="small" loading={saving} onPress={finish} />
      ) : (
        <>
          {right}
          {onDelete ? (
            <Pressable
              onPress={onDelete}
              disabled={deleteBlocked}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${value}`}
              accessibilityState={{ disabled: deleteBlocked }}
              style={({ pressed }) => [styles.trash, pressed && styles.trashPressed, deleteBlocked && styles.trashBlocked]}
            >
              <Icon name="trash" size={17} color={deleteBlocked ? colors.faint : tones.rose.text} />
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 10 },
  texts: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  muted: { color: colors.muted },
  detail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  input: {
    height: 40,
    borderWidth: 2,
    borderColor: colors.selectBar,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.ink,
    paddingVertical: 0,
  },
  trash: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  trashPressed: { backgroundColor: tones.rose.bg },
  trashBlocked: { opacity: 0.55 },
});
