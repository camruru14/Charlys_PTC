import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useVehicles } from "../hooks/useVehicles";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";

// Crear/editar un vehículo (un solo campo, la placa). Si el backend
// devuelve 400 por placa duplicada, ese mensaje se muestra tal cual.
export default function VehiculoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { vehicles, loading: vehiclesLoading, crear, actualizar, eliminar } = useVehicles();

  const [plate, setPlate] = useState("");
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const vehicle = vehicles.find((v) => v._id === id);
    if (vehicle) {
      setPlate(vehicle.plate || "");
      setLoaded(true);
      return;
    }
    if (!vehiclesLoading) {
      Alert.alert("No se encontró el vehículo", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, vehicles, vehiclesLoading, navigation]);

  const handleSave = async () => {
    if (!plate.trim()) {
      Alert.alert("Falta información", "La placa es obligatoria");
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        await actualizar(id, { plate });
      } else {
        await crear({ plate });
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
    title: isEditing ? "Editar vehículo" : "Agregar vehículo",
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
      <FormField
        label="Placa"
        value={plate}
        onChangeText={setPlate}
        placeholder="P-000-XXX"
        autoCapitalize="characters"
        required
      />

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar el vehículo "${plate}"? Los pedidos que ya lo tengan asignado no se ven afectados, pero no se podrá elegir de nuevo.`}
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
