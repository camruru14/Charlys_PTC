import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useEmployees } from "../hooks/useEmployees";
import PermissionChip from "../components/employees/PermissionChip";
import BottomBar from "../components/ui/BottomBar";
import FormField from "../components/ui/FormField";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import PasswordField from "../components/ui/PasswordField";
import SelectField from "../components/ui/SelectField";
import SwitchField from "../components/ui/SwitchField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatDui, isValidDui, maskDui } from "../lib/dui";
import { DEPARTMENTS } from "../lib/permissions";

const MIN_PASSWORD_LENGTH = 6;

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

// Alta y edición de empleados (EmployeeFormModal.jsx de la web; se abre desde
// Configuración > Personal y permisos y desde la ficha del empleado). La
// app nunca lee ni muestra la contraseña guardada: al editar, el campo
// arranca vacío y solo se manda si se escribe una nueva. Eliminar está en el
// «···» del encabezado.
export default function EmpleadoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { employees, loading, crear, actualizar, eliminar } = useEmployees();

  const [form, setForm] = useState(isEditing ? null : emptyForm);
  const [saving, setSaving] = useState(false);

  const employee = isEditing ? employees.find((e) => e._id === id) : null;

  useEffect(() => {
    if (!isEditing || form) return;
    if (employee) {
      setForm({
        name: employee.name || "",
        lastName: employee.lastName || "",
        dui: formatDui(employee.dui),
        phone: employee.phone || "",
        email: employee.email || "",
        password: "",
        position: employee.position || "",
        department: employee.department || "Fabricación",
        hourlyRate: employee.hourlyRate != null ? String(employee.hourlyRate) : "",
        isActive: employee.isActive !== false,
      });
      return;
    }
    if (!loading) {
      Alert.alert("No se encontró el empleado", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, employee, loading, navigation]);

  const confirmDelete = useCallback(() => {
    if (!employee) return;
    Alert.alert(
      "Eliminar empleado",
      `¿Eliminar a ${employee.name} ${employee.lastName}? Se borra también su historial de asistencia.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminar(employee._id);
              toast.show("Empleado eliminado");
              navigation.goBack();
            } catch (err) {
              Alert.alert("No se pudo eliminar", err.message);
            }
          },
        },
      ],
    );
  }, [employee, eliminar, navigation, toast]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Editar empleado" : "Nuevo empleado",
      headerRight: isEditing
        ? () => (
            <IconButton
              icon="more"
              accessibilityLabel="Más acciones del empleado"
              onPress={() =>
                Alert.alert("Empleado", undefined, [
                  { text: "Eliminar empleado", style: "destructive", onPress: confirmDelete },
                  { text: "Cancelar", style: "cancel" },
                ])
              }
            />
          )
        : undefined,
    });
  }, [navigation, isEditing, confirmDelete]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: field === "dui" ? maskDui(value) : value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.lastName.trim()) return Alert.alert("Falta información", "Nombre y apellido son obligatorios");
    if (!form.email.trim()) return Alert.alert("Falta información", "El correo es obligatorio");
    if (!isEditing && !form.password) return Alert.alert("Falta información", "La contraseña es obligatoria");
    if (form.password && form.password.length < MIN_PASSWORD_LENGTH) {
      return Alert.alert("Revisa la contraseña", `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    // Igual que el pattern del DUI de la web: vacío o «12345678-9».
    if (form.dui && !isValidDui(form.dui)) return Alert.alert("DUI inválido", "El DUI debe tener 9 números (ej. 12345678-9)");

    setSaving(true);
    const payload = { ...form, hourlyRate: Number(form.hourlyRate) || 0 };
    // Al editar, vacía = no cambiarla: el campo no se manda.
    if (!payload.password) delete payload.password;
    try {
      if (isEditing) {
        await actualizar(id, payload);
        toast.show("Empleado actualizado");
      } else {
        await crear(payload);
        toast.show("Empleado creado");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  if (!form) return <LoadingState />;

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <FormField label="Nombre" value={form.name} onChangeText={(v) => handleChange("name", v)} required />
        <FormField label="Apellido" value={form.lastName} onChangeText={(v) => handleChange("lastName", v)} required />
        <FormField
          label="DUI"
          value={form.dui}
          onChangeText={(v) => handleChange("dui", v)}
          placeholder="12345678-9"
          keyboardType="number-pad"
          maxLength={10}
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
        <PasswordField
          label="Contraseña"
          value={form.password}
          onChangeText={(v) => handleChange("password", v)}
          placeholder={isEditing ? "Nueva contraseña" : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          required={!isEditing}
          note={isEditing ? "Déjalo vacío para no cambiarla." : undefined}
        />
        <SelectField
          label="Área"
          value={form.department}
          options={DEPARTMENTS.map((d) => ({ label: d, value: d }))}
          onChange={(v) => handleChange("department", v)}
        />
        <FormField
          label="Puesto"
          value={form.position}
          onChangeText={(v) => handleChange("position", v)}
          placeholder="Ej. Operario"
        />
        <View style={styles.permission}>
          <PermissionChip employee={form} />
          <Text style={styles.aux}>Informativo: según área y puesto; todavía no restringe el acceso.</Text>
        </View>
        <FormField
          label="Valor por hora ($)"
          value={form.hourlyRate}
          onChangeText={(v) => handleChange("hourlyRate", v.replace(",", ".").replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
        />
        <SwitchField label="Empleado activo" value={form.isActive} onValueChange={(v) => handleChange("isActive", v)} />
      </KeyboardScreen>

      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          { title: "Guardar", loading: saving, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  permission: { gap: 6, marginTop: -4, marginBottom: 16 },
  aux: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
