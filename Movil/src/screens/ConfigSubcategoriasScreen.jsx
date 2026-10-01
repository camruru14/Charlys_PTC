import { useCallback, useLayoutEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SUBCATEGORY_CATEGORIES, useSubcategories } from "../hooks/useSubcategories";
import BottomSheet from "../components/ui/BottomSheet";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import SegmentedField from "../components/ui/SegmentedField";
import SwitchField from "../components/ui/SwitchField";
import { RowIcon } from "../components/settings/SettingsRow";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

const ALL = "todas";
const IN_USE_NOTE = "Ya se usa en registros: no se puede cambiar el nombre ni la categoría, ni eliminarla. Puedes desactivarla.";

// Hoja para agregar (sub === null) o editar una subcategoría: nombre,
// categoría y, al editar, si está activa. Si ya se usa en registros el nombre y
// la categoría quedan bloqueados (el backend también lo impide).
function SubcategorySheet({ state, defaultCategory, onClose, onCreate, onUpdate, onDelete }) {
  const sub = state.sub;
  const [name, setName] = useState(sub?.name || "");
  const [category, setCategory] = useState(sub?.category || defaultCategory);
  const [active, setActive] = useState(sub ? sub.active : true);
  const [saving, setSaving] = useState(false);
  const locked = Boolean(sub?.inUse);

  const save = async () => {
    const value = name.trim();
    if (!value) return Alert.alert("Falta información", "Escribe el nombre de la subcategoría");
    const changes = {};
    if (!sub || value !== sub.name) changes.name = value;
    if (!sub || category !== sub.category) changes.category = category;
    if (sub && active !== sub.active) changes.active = active;
    if (sub && !Object.keys(changes).length) return onClose();
    setSaving(true);
    try {
      if (sub) await onUpdate(sub, changes, value);
      else await onCreate(changes, value);
      onClose();
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <BottomSheet
      visible={state.open}
      onClose={onClose}
      title={sub ? "Editar subcategoría" : "Nueva subcategoría"}
      subtitle="Su nombre es el producto que se muestra en el sistema"
      footer={
        <>
          <Button title={sub ? "Guardar" : "Agregar"} loading={saving} onPress={save} />
          {sub ? (
            <Button
              title="Eliminar"
              variant="danger"
              disabled={locked || saving}
              onPress={() => onDelete(sub)}
            />
          ) : null}
        </>
      }
    >
      <FormField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej. Pajilla jumbo"
        editable={!locked}
        autoFocus={!sub}
        returnKeyType="done"
        required
      />
      {locked ? (
        <FormField label="Categoría" value={category} editable={false} onChangeText={() => {}} />
      ) : (
        <SegmentedField label="Categoría" options={SUBCATEGORY_CATEGORIES} value={category} onChange={setCategory} required />
      )}
      {sub ? (
        <SwitchField
          label="Activa"
          description="Se puede elegir al crear o editar productos"
          value={active}
          onValueChange={setActive}
        />
      ) : null}
      {locked ? <Text style={styles.note}>{IN_USE_NOTE}</Text> : null}
    </BottomSheet>
  );
}

// Configuración > Subcategorías (Subcategorias.jsx de la web). Cada una
// pertenece a una categoría del catálogo (Pajillas o Pelotas); las activas son
// las opciones al crear o editar un producto. Tocar la fila abre la hoja de
// edición; la Pill activa o desactiva; la basura elimina (bloqueada si ya se
// usa en registros). «+» agrega una.
export default function ConfigSubcategoriasScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { subcategories, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useSubcategories();
  const [filter, setFilter] = useState(ALL);
  // Hoja de crear/editar: { key, sub, open }. `sub` null = nueva. Al cerrar solo
  // baja `open` (la hoja sigue montada para la animación de salida); cada
  // apertura cambia `key`, así el formulario arranca con los datos de esa fila.
  const [sheet, setSheet] = useState(null);
  const openSheet = (sub) => setSheet((prev) => ({ key: (prev?.key || 0) + 1, sub, open: true }));
  const closeSheet = () => setSheet((prev) => (prev ? { ...prev, open: false } : prev));

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Subcategorías",
      headerSubtitle: "Las activas se eligen al crear un producto",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => openSheet(null)} accessibilityLabel="Agregar subcategoría" />
      ),
    });
  }, [navigation]);

  const options = [
    { value: ALL, label: "Todas", count: formatNumber(subcategories.length) },
    ...SUBCATEGORY_CATEGORIES.map((c) => ({
      value: c,
      label: c,
      count: formatNumber(subcategories.filter((s) => s.category === c).length),
    })),
  ];
  const items = filter === ALL ? subcategories : subcategories.filter((s) => s.category === filter);

  const remove = (sub) =>
    Alert.alert("Eliminar subcategoría", `¿Eliminar «${sub.name}»? Ya no se podrá elegir al crear o editar productos.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(sub._id);
            toast.show(`${sub.name} eliminada`);
            closeSheet();
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
            refresh();
          }
        },
      },
    ]);

  const toggleActive = (sub) => {
    const next = !sub.active;
    Alert.alert(
      next ? "Activar subcategoría" : "Desactivar subcategoría",
      next
        ? `«${sub.name}» volverá a poder elegirse al crear o editar productos.`
        : `«${sub.name}» ya no se podrá elegir al crear o editar productos. Los productos que ya la tienen la conservan.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: next ? "Activar" : "Desactivar",
          onPress: async () => {
            try {
              await actualizar(sub._id, { active: next });
              toast.show(`${sub.name} actualizada`);
            } catch (err) {
              Alert.alert("No se pudo actualizar", err.message);
            }
          },
        },
      ],
    );
  };

  if (loading && !subcategories.length) return <LoadingState />;
  if (error && !subcategories.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, bottomPad]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <FilterChips options={options} value={filter} onChange={setFilter} style={styles.filters} />

        {items.length ? (
          <ListGroup>
            {items.map((sub) => {
              const status = sub.active ? "Activa" : "Inactiva";
              return (
                <View key={sub._id} style={styles.row}>
                  <Pressable
                    style={styles.main}
                    onPress={() => openSheet(sub)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${sub.name}`}
                  >
                    <RowIcon icon="tag" />
                    <View style={styles.texts}>
                      <Text style={[styles.name, !sub.active && styles.muted]} numberOfLines={1}>
                        {sub.name}
                      </Text>
                      <Text style={styles.detail} numberOfLines={1}>
                        {sub.category} · {sub.inUse ? "En uso en registros" : "Sin registros"}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleActive(sub)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${status}: tocar para ${sub.active ? "desactivar" : "activar"}`}
                  >
                    <Pill label={status} tone={statusTone(status, "linea")} />
                  </Pressable>
                  <Pressable
                    onPress={() => remove(sub)}
                    disabled={sub.inUse}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar ${sub.name}`}
                    accessibilityState={{ disabled: sub.inUse }}
                    style={({ pressed }) => [styles.trash, pressed && styles.trashPressed, sub.inUse && styles.trashBlocked]}
                  >
                    <Icon name="trash" size={17} color={sub.inUse ? colors.faint : tones.rose.text} />
                  </Pressable>
                </View>
              );
            })}
          </ListGroup>
        ) : (
          <EmptyState
            icon="tag"
            message={subcategories.length ? "No hay subcategorías en esta categoría." : "No hay subcategorías registradas."}
          />
        )}
        <Text style={styles.note}>
          Toca el estado para activar o desactivar. Una subcategoría que ya se usa en registros solo se puede desactivar.
        </Text>
      </ScrollView>

      {sheet ? (
      <SubcategorySheet
        key={sheet.key}
        state={sheet}
        defaultCategory={filter === ALL ? SUBCATEGORY_CATEGORIES[0] : filter}
        onClose={closeSheet}
        onCreate={async (changes, name) => {
          await crear(changes);
          toast.show(`${name} agregada`);
        }}
        onUpdate={async (sub, changes, name) => {
          await actualizar(sub._id, changes);
          toast.show(`${name} actualizada`);
        }}
        onDelete={remove}
      />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  filters: { marginBottom: 12 },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 15, paddingVertical: 10 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 15 },
  texts: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  muted: { color: colors.muted },
  detail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
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
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
