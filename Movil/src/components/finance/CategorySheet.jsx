import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import BottomSheet from "../ui/BottomSheet";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Icon from "../ui/Icon";
import CategoryAvatar from "./CategoryAvatar";
import { colors, tones } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";
import { COLOR_KEYS, ICON_KEYS, categoryIconName, categoryTone, parseBudget } from "../../lib/expenseCategories";
import { money, plural } from "../../lib/finance";

// Monto del presupuesto: solo dígitos y un punto (nunca negativo).
const cleanMoney = (text) => text.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

// Hoja para crear o editar una categoría de gasto (Configuración › Categorías
// de gasto): nombre, presupuesto mensual (vigente desde el mes en curso),
// ícono y color. Con `category` edita y puede archivar; sin ella crea.
//   Guardar: PUT /expense-categories/:id si cambió nombre, ícono o color, y
//   PUT /expense-categories/budgets (mes en curso) si cambió el presupuesto.
export default function CategorySheet({ category, monthName, month, onClose, actions }) {
  const isNew = !category;
  const saved = category?.usage?.budget ?? null;
  const [name, setName] = useState(category?.name || "");
  const [budget, setBudget] = useState(saved == null ? "" : String(saved));
  const [icon, setIcon] = useState(category?.icon || "tag");
  const [color, setColor] = useState(category?.color || "gray");
  const [saving, setSaving] = useState(false);

  const tone = categoryTone(color);
  const parsed = parseBudget(budget);
  const budgetChanged = !Number.isNaN(parsed) && parsed !== saved;
  const usage = category?.usage;

  const budgetNote = isNew
    ? parsed == null || Number.isNaN(parsed)
      ? "Opcional. Aplica desde " + monthName + " y se repite cada mes."
      : `Aplica desde ${monthName} y se repite cada mes`
    : !budgetChanged
      ? `Aplica desde ${monthName} y se repite cada mes`
      : parsed == null
        ? `Sin presupuesto desde ${monthName} · antes ${money(saved)}`
        : `Antes ${saved == null ? "sin presupuesto" : money(saved)} · aplica desde ${monthName}`;

  const save = async () => {
    const clean = name.trim();
    if (!clean) {
      Alert.alert("Falta información", "Escribe el nombre de la categoría");
      return;
    }
    if (Number.isNaN(parsed)) {
      Alert.alert("Falta información", "El presupuesto debe ser un número mayor o igual a 0");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await actions.crear({ name: clean, icon, color, ...(parsed != null ? { budget: parsed } : {}) });
        actions.toast(`Categoría «${clean}» creada`);
      } else {
        const fields = {};
        if (clean !== category.name) fields.name = clean;
        if (icon !== category.icon) fields.icon = icon;
        if (color !== category.color) fields.color = color;
        if (Object.keys(fields).length) await actions.actualizar(category._id, fields);
        if (budgetChanged) await actions.guardarPresupuestos(month, [{ id: category._id, amount: parsed }]);
        actions.toast("Categoría actualizada");
      }
      onClose();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  const archive = () =>
    Alert.alert(
      "Archivar categoría",
      `«${category.name}» ya no aparecerá al registrar un gasto. Sus movimientos se conservan y puedes restaurarla desde «Ver archivadas».`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await actions.actualizar(category._id, { archived: true });
              actions.toast(`«${category.name}» archivada`);
              onClose();
            } catch (error) {
              Alert.alert("No se pudo archivar", error.message || "Intenta de nuevo");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );

  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissable={!saving}
      title={isNew ? "Nueva categoría" : category.name}
      subtitle={isNew ? undefined : `${plural(usage?.count ?? 0, "movimiento", "movimientos")} · ${money(usage?.paid ?? 0)} en ${monthName}`}
      footer={
        <View style={styles.footer}>
          {!isNew ? (
            <Pressable onPress={archive} disabled={saving} accessibilityRole="button" style={({ pressed }) => [styles.archive, pressed && { backgroundColor: colors.rowAlert }]}>
              <Text style={styles.archiveText}>Archivar</Text>
            </Pressable>
          ) : null}
          <Button title="Guardar" loading={saving} onPress={save} style={styles.save} />
        </View>
      }
    >
      <View style={styles.preview}>
        <CategoryAvatar icon={icon} color={color} size={44} />
        <Text style={styles.previewName} numberOfLines={1}>
          {name.trim() || "Nombre de la categoría"}
        </Text>
      </View>

      <FormField label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Papelería" required />

      <Text style={[type.overline, styles.label]}>Presupuesto mensual</Text>
      <View style={styles.budgetBox}>
        <Text style={styles.currency}>$</Text>
        <TextInput
          style={styles.budget}
          value={budget}
          onChangeText={(v) => setBudget(cleanMoney(v))}
          keyboardType="decimal-pad"
          placeholder="Sin presupuesto"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Presupuesto mensual"
        />
      </View>
      <Text style={styles.note}>{budgetNote}</Text>

      <Text style={[type.overline, styles.label]}>Ícono y color</Text>
      <View style={styles.icons}>
        {ICON_KEYS.map((key) => {
          const selected = key === icon;
          return (
            <Pressable
              key={key}
              onPress={() => setIcon(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Ícono ${key}`}
              style={[styles.iconCell, selected && { backgroundColor: tone.bg, borderColor: tone.dot }]}
            >
              <Icon name={categoryIconName(key)} size={20} color={selected ? tone.text : colors.muted} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.colors}>
        {COLOR_KEYS.map((key) => {
          const selected = key === color;
          return (
            <Pressable
              key={key}
              onPress={() => setColor(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Color ${key}`}
              style={[styles.swatch, { backgroundColor: tones[key].dot }, selected && styles.swatchSelected]}
            >
              {selected ? <Icon name="check" size={14} color={colors.white} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  previewName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  label: { marginBottom: 8 },
  budgetBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  currency: { fontFamily: fonts.bold, fontSize: 24, color: colors.muted },
  budget: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 6, marginBottom: 18 },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  swatchSelected: { borderWidth: 3, borderColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.5, shadowRadius: 0, elevation: 3 },
  footer: { flexDirection: "row", gap: 10 },
  archive: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveText: { fontFamily: fonts.semibold, fontSize: 15, color: tones.rose.text },
  save: { flex: 1 },
});
