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
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatDui, isValidDui, maskDui } from "../lib/dui";
import { DEPARTMENTS } from "../lib/permissions";

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
// Configuración > Personal y permisos y desde la ficha del empleado). Al
// editar, la contraseña se precarga con la guardada (GET
// /employees/:id/password) y, si no se cambia, no se manda. Eliminar está en
// el «···» del encabezado.
export default function EmpleadoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { employees, loading, crear, actualizar, eliminar } = useEmployees();

  const [form, setForm] = useState(isEditing ? null : emptyForm);
  const [saving, setSaving] = useState(false);
  // Contraseña guardada: null (cargando) | { password, legacy }
  const [stored, setStored] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

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

  // Contraseña guardada (desencriptada por el backend), como la web. Las
  // antiguas (hash bcrypt) no se pueden mostrar: el campo queda vacío.
  useEffect(() => {
    if (!isEditing) return undefined;
    let ignore = false;
    api
      .get(`/employees/${id}/password`)
      .then((result) => {
        if (ignore) return;
        setStored({ password: result?.password ?? null, legacy: Boolean(result?.legacy) });
        if (result?.password) setForm((f) => (f && !f.password ? { ...f, password: result.password } : f));
      })
      .catch((err) => !ignore && setPasswordError(err.message));
    return () => {
      ignore = true;
    };
  }, [isEditing, id]);

  // Si el formulario se llena después de cargar la contraseña, se precarga.
  useEffect(() => {
    if (form && !form.password && stored?.password && isEditing) {
      setForm((f) => ({ ...f, password: stored.password }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(form), stored]);

  const loadingPassword = isEditing && !stored && !passwordError;
  const savedPassword = stored?.password ?? null;

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
    // Igual que el pattern del DUI de la web: vacío o «12345678-9».
    if (form.dui && !isValidDui(form.dui)) return Alert.alert("DUI inválido", "El DUI debe tener 9 números (ej. 12345678-9)");

    setSaving(true);
    const payload = { ...form, hourlyRate: Number(form.hourlyRate) || 0 };
    // Sin cambio de contraseña: vacía o igual a la precargada.
    if (isEditing && (!payload.password || payload.password === savedPassword)) delete payload.password;
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

  // Nota bajo la contraseña al editar (la misma lógica que la web).
  let passwordNote;
  if (isEditing) {
    if (passwordError) passwordNote = `No se pudo cargar la contraseña guardada (${passwordError}). Déjalo vacío para no cambiarla.`;
    else if (form.password && form.password === savedPassword) passwordNote = "Contraseña guardada. Si no la cambias, queda igual.";
    else if (form.password) passwordNote = "Se guardará como la nueva contraseña.";
    else if (stored?.legacy)
      passwordNote =
        "Esta contraseña no se puede mostrar hasta que se actualice; escribe una nueva para reemplazarla. Mientras tanto, el empleado sigue entrando con la actual.";
    else passwordNote = "Vacío: la contraseña queda igual.";
  }

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
          placeholder={loadingPassword ? "Cargando…" : isEditing ? "Escribe una contraseña nueva" : "Contraseña"}
          editable={!loadingPassword}
          autoComplete="new-password"
          required={!isEditing}
          note={passwordNote}
          noteColor={stored?.legacy && !form.password ? colors.amberStrong : undefined}
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
