import { useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useEmployees } from "../hooks/useEmployees";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import SwitchField from "../components/ui/SwitchField";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";

const DEPARTMENTS = ["Fabricación", "Logística", "Administración", "Almacén", "Finanzas"];

const emptyForm = {
  name: "",
  lastName: "",
  dui: "",
  phone: "",
  email: "",
  password: "",
  position: "",
  department: "Fabricación",
  hourlyRate: "",
  isActive: true,
};

// Crear/editar un empleado. `password` es obligatorio al crear, pero
// opcional al editar (si se deja vacío, no se manda en el PUT y el backend
// no toca la contraseña ya guardada — ver employeesController.updateEmployee).
// No hay campo de fecha de contratación: pages/Empleados.jsx en la web
// tampoco lo tiene en este formulario.
export default function EmpleadoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const { employees, loading: employeesLoading, crear, actualizar, eliminar } = useEmployees();

  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const employee = employees.find((e) => e._id === id);
    if (employee) {
      setForm({
        name: employee.name || "",
        lastName: employee.lastName || "",
        dui: employee.dui || "",
        phone: employee.phone || "",
        email: employee.email || "",
        password: "",
        position: employee.position || "",
        department: employee.department || "Fabricación",
        hourlyRate: employee.hourlyRate != null ? String(employee.hourlyRate) : "",
        isActive: employee.isActive !== false,
      });
      setLoaded(true);
      return;
    }
    if (!employeesLoading) {
      Alert.alert("No se encontró el empleado", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, employees, employeesLoading, navigation]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleDuiChange = (value) => handleChange("dui", value.replace(/\D/g, "").slice(0, 9));

  const handleSave = async () => {
    if (!form.name.trim() || !form.lastName.trim()) {
      Alert.alert("Falta información", "Nombre y apellido son obligatorios");
      return;
    }
    if (!form.email.trim()) {
      Alert.alert("Falta información", "El correo es obligatorio");
      return;
    }
    if (!isEditing && !form.password) {
      Alert.alert("Falta información", "La contraseña es obligatoria");
      return;
    }
    // Igual que el pattern="\d{9}" del input de la web: el DUI puede ir
    // vacío, pero si se escribió algo tiene que ser un DUI completo.
    if (form.dui && form.dui.length !== 9) {
      Alert.alert("DUI inválido", "El DUI debe tener 9 números");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      lastName: form.lastName.trim(),
      dui: form.dui || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim(),
      position: form.position.trim() || undefined,
      department: form.department,
      hourlyRate: form.hourlyRate === "" ? undefined : Number(form.hourlyRate) || 0,
      isActive: form.isActive,
    };
    // Solo se manda `password` si el usuario escribió algo: en edición,
    // dejarlo vacío significa "no cambiarla".
    if (form.password) payload.password = form.password;
    try {
      if (isEditing) {
        await actualizar(id, payload);
      } else {
        await crear(payload);
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
    title: isEditing ? "Editar empleado" : "Registrar empleado",
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
      <FormField label="Nombre" value={form.name} onChangeText={(v) => handleChange("name", v)} required />
      <FormField label="Apellido" value={form.lastName} onChangeText={(v) => handleChange("lastName", v)} required />
      <FormField
        label="DUI"
        value={form.dui}
        onChangeText={handleDuiChange}
        placeholder="123456789"
        keyboardType="numeric"
      />
      <FormField label="Teléfono" value={form.phone} onChangeText={(v) => handleChange("phone", v)} keyboardType="phone-pad" />
      <FormField
        label="Correo"
        value={form.email}
        onChangeText={(v) => handleChange("email", v)}
        keyboardType="email-address"
        autoCapitalize="none"
        required
      />
      <FormField
        label="Contraseña"
        value={form.password}
        onChangeText={(v) => handleChange("password", v)}
        placeholder={isEditing ? "Dejar en blanco para no cambiarla" : "Contraseña"}
        secureTextEntry
        autoCapitalize="none"
        required={!isEditing}
      />
      <FormField label="Puesto" value={form.position} onChangeText={(v) => handleChange("position", v)} />
      <SegmentedField
        label="Área"
        value={form.department}
        options={DEPARTMENTS}
        onChange={(v) => handleChange("department", v)}
      />
      <FormField
        label="Valor por hora ($)"
        value={form.hourlyRate}
        onChangeText={(v) => handleChange("hourlyRate", v)}
        keyboardType="numeric"
      />

      <SwitchField label="Empleado activo" value={form.isActive} onValueChange={(v) => handleChange("isActive", v)} />

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar a ${form.name} ${form.lastName}?`}
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
