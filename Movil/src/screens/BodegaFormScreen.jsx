import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useWarehouses } from "../hooks/useWarehouses";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";

// Crear/editar una bodega (un solo campo, el nombre). Si el backend
// devuelve 400 por nombre duplicado, ese mensaje se muestra tal cual.
export default function BodegaFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { warehouses, loading: warehousesLoading, crear, actualizar, eliminar } = useWarehouses();

  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const warehouse = warehouses.find((w) => w._id === id);
    if (warehouse) {
      setName(warehouse.name || "");
      setLoaded(true);
      return;
    }
    if (!warehousesLoading) {
      Alert.alert("No se encontró la bodega", "Puede que ya haya sido eliminada.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, warehouses, warehousesLoading, navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Falta información", "El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await actualizar(id, { name });
      } else {
        await crear({ name });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  useSaveCancelHeader({
    navigation,
    title: isEditing ? "Editar bodega" : "Agregar bodega",
    saving,
    onSave: handleSave,
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eliminar(id);
      navigation.goBack();
    } catch (error) {
      setDeleting(false);
      Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
    }
  };

  if (isEditing && !loaded) return <LoadingState />;

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <FormField label="Nombre de la bodega" value={name} onChangeText={setName} placeholder="Bodega A-1" required />

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar la bodega "${name}"? Los artículos que ya la tengan asignada no se ven afectados, pero no se podrá elegir de nuevo.`}
          onConfirm={handleDelete}
          disabled={deleting}
          label={deleting ? "Eliminando…" : "Eliminar"}
        />
      ) : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
});
