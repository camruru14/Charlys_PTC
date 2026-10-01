import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useEmployees } from "../hooks/useEmployees";
import BottomBar from "../components/ui/BottomBar";
import FormField from "../components/ui/FormField";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import SelectField from "../components/ui/SelectField";
import SwitchField from "../components/ui/SwitchField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { formatDui } from "../lib/format";

// Áreas del enum de Employee.department (lib/permissions.js de la web).
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

// DUI mientras se escribe: solo números, con el guion antes del último
// dígito («12345678-9», maskDui de la web). Se guarda sin guion.
const duiDigits = (value) => String(value || "").replace(/\D/g, "").slice(0, 9);

// Crear/editar un empleado. `password` es obligatorio al crear, pero
// opcional al editar (si se deja vacío, no se manda en el PUT y el backend
// no toca la contraseña ya guardada — ver employeesController.updateEmployee).
// Eliminar está en el «···» del encabezado.
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
        dui: duiDigits(employee.dui),
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
              // La ficha del empleado ya no existe: se vuelve a la lista.
              navigation.popToTop();
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

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

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
    // Igual que el pattern del DUI de la web: puede ir vacío, pero si se
    // escribió algo tiene que tener los 9 números.
    if (form.dui && form.dui.length !== 9) {
      Alert.alert("DUI inválido", "El DUI debe tener 9 números (ej. 12345678-9)");
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
    // Solo se manda `password` si se escribió algo: en edición, vacío
    // significa "no cambiarla".
    if (form.password) payload.password = form.password;
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
  };

  if (!form) return <LoadingState />;

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <FormField label="Nombre" value={form.name} onChangeText={(v) => handleChange("name", v)} required />
        <FormField label="Apellido" value={form.lastName} onChangeText={(v) => handleChange("lastName", v)} required />
        <View style={styles.columns}>
          <FormField
            label="DUI"
            value={formatDui(form.dui) || form.dui}
            onChangeText={(v) => handleChange("dui", duiDigits(v))}
            placeholder="12345678-9"
            keyboardType="number-pad"
            maxLength={10}
            style={styles.column}
          />
          <FormField
            label="Teléfono"
            value={form.phone}
            onChangeText={(v) => handleChange("phone", v)}
            keyboardType="phone-pad"
            style={styles.column}
          />
        </View>
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
          placeholder={isEditing ? "Vacío: la contraseña queda igual" : "Contraseña"}
          secureTextEntry
          autoCapitalize="none"
          required={!isEditing}
        />
        <View style={styles.columns}>
          <SelectField
            label="Área"
            value={form.department}
            options={DEPARTMENTS.map((d) => ({ label: d, value: d }))}
            onChange={(v) => handleChange("department", v)}
            style={styles.column}
          />
          <FormField
            label="Puesto"
            value={form.position}
            onChangeText={(v) => handleChange("position", v)}
            placeholder="Ej. Operario"
            style={styles.column}
          />
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
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
});
