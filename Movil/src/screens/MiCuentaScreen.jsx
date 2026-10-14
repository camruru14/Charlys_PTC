import { afterSheetClose } from "../lib/afterSheetClose";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useAccount } from "../hooks/useAccount";
import { useAuth } from "../hooks/useAuth";
import PermissionChip from "../components/employees/PermissionChip";
import { roleLine } from "../components/employees/EmployeeRow";
import Avatar, { personTone, photoOf } from "../components/ui/Avatar";
import BottomBar from "../components/ui/BottomBar";
import BottomSheet from "../components/ui/BottomSheet";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import CurrentPasswordField from "../components/ui/CurrentPasswordField";
import ErrorState from "../components/ui/ErrorState";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import LoadingState from "../components/ui/LoadingState";
import PasswordField from "../components/ui/PasswordField";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatDui, isValidDui, maskDui } from "../lib/dui";
import { pickProfilePhoto } from "../lib/pickImages";
import { fullName } from "../lib/attendance";

const emptyForm = { name: "", lastName: "", phone: "", dui: "", newEmail: "", newPassword: "" };
const MIN_PASSWORD_LENGTH = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Hoja con lo que se puede hacer con la foto de perfil.
//   hasPhoto: «Quitar foto» solo aparece si ya tiene una.
function PhotoSheet({ visible, hasPhoto, onClose, onCamera, onLibrary, onRemove }) {
  const options = [
    { key: "camera", title: "Tomar foto", icon: "camera", onPress: onCamera },
    { key: "library", title: "Elegir de la galería", icon: "image", onPress: onLibrary },
    ...(hasPhoto ? [{ key: "remove", title: "Quitar foto", icon: "trash", danger: true, onPress: onRemove }] : []),
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Foto de perfil">
      <View style={styles.options}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={o.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <Icon name={o.icon} size={20} color={o.danger ? tones.rose.text : colors.ink} />
            <Text style={[styles.optionText, o.danger && { color: tones.rose.text }]}>{o.title}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

// Hoja que pide la contraseña actual antes de aplicar un cambio de correo o
// de contraseña (ConfirmPasswordModal de la web). El error de una contraseña
// incorrecta se muestra aquí mismo y no se guarda nada.
//   state: { value, error } | null
function ConfirmPasswordSheet({ state, busy, onChange, onClose, onConfirm }) {
  return (
    <BottomSheet
      visible={Boolean(state)}
      onClose={onClose}
      dismissable={!busy}
      title="Confirma tu contraseña actual"
      subtitle="Para cambiar tu correo o tu contraseña necesitamos confirmar que eres tú."
      footer={
        <View style={styles.sheetFooter}>
          <Button title="Cancelar" variant="secondary" disabled={busy} onPress={onClose} style={styles.flex} />
          <Button
            title="Confirmar y guardar"
            loading={busy}
            disabled={!state?.value}
            onPress={() => state?.value && onConfirm(state.value)}
            style={styles.flex}
          />
        </View>
      }
    >
      <PasswordField
        label="Contraseña actual"
        value={state?.value || ""}
        onChangeText={onChange}
        autoComplete="current-password"
        autoFocus
        required
        note={state?.error || undefined}
        noteColor={state?.error ? tones.rose.text : undefined}
      />
    </BottomSheet>
  );
}

// Configuración > Mi cuenta (MiCuenta.jsx y la parte de Mi cuenta de
// Configuracion.jsx en la web): foto de perfil (se sube al momento, sin
// «Guardar cambios»), nombre, apellido, teléfono y DUI (PUT /auth/me) y el cambio de
// correo o contraseña (PUT /auth/me/credentials), que pide la contraseña
// actual al guardar. Los datos de OTRO empleado se editan en Personal y
// permisos.
export default function MiCuentaScreen({ navigation }) {
  const toast = useToast();
  const { updateUser, sessionPassword, setSessionPassword } = useAuth();
  const {
    account,
    loading,
    refreshing,
    error,
    refresh,
    guardarPerfil,
    subirFoto,
    quitarFoto,
    cambiarAcceso,
    storedPassword,
    refreshStoredPassword,
  } = useAccount();
  const [draft, setDraft] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const savedForm = account
    ? { ...emptyForm, name: account.name || "", lastName: account.lastName || "", phone: account.phone || "", dui: formatDui(account.dui) }
    : emptyForm;
  const form = draft ?? savedForm;
  const profileDirty =
    Boolean(account) &&
    (form.name.trim() !== savedForm.name ||
      form.lastName.trim() !== savedForm.lastName ||
      form.phone.trim() !== savedForm.phone ||
      form.dui !== savedForm.dui);
  // Escribir en «Cambiar correo» o «Cambiar contraseña» ya cuenta como cambio.
  const credentialsTouched = Boolean(form.newEmail.trim() || form.newPassword);
  const dirty = Boolean(account && draft) && (profileDirty || credentialsTouched);

  // Salir con cambios sin guardar: se pregunta antes.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dirty || saving) return;
        e.preventDefault();
        Alert.alert("Cambios sin guardar", "¿Salir sin guardar los cambios de tu cuenta?", [
          { text: "Seguir editando", style: "cancel" },
          { text: "Descartar", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty, saving],
  );

  const setField = (field, value) => setDraft({ ...form, [field]: field === "dui" ? maskDui(value) : value });

  // La foto se sube (o se quita) al momento y la sesión se actualiza para que
  // el menú lateral la muestre.
  // Cámara, galería y Alert esperan a que la hoja termine de cerrarse (en iOS no se presentan encima).
  const changePhoto = (source) => {
    setPhotoSheet(false);
    afterSheetClose(() => uploadPhoto(source));
  };

  const uploadPhoto = async (source) => {
    const file = await pickProfilePhoto(source);
    if (!file) return;
    if (file.size && file.size > MAX_PHOTO_BYTES) return Alert.alert("Foto de perfil", "La foto no puede pesar más de 5 MB");
    setPhotoBusy(true);
    try {
      const saved = await subirFoto({ uri: file.uri, name: file.name, type: file.type });
      updateUser({ photoUrl: saved?.photoUrl ?? null });
      toast.show("Foto actualizada");
    } catch (err) {
      Alert.alert("No se pudo subir la foto", err.message);
    } finally {
      setPhotoBusy(false);
    }
    return undefined;
  };

  const removePhoto = () => {
    setPhotoSheet(false);
    afterSheetClose(confirmRemovePhoto);
  };

  const confirmRemovePhoto = () => {
    Alert.alert("Quitar foto", "Se quitará tu foto de perfil y volverán tus iniciales.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar foto",
        style: "destructive",
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await quitarFoto();
            updateUser({ photoUrl: null });
            toast.show("Foto quitada");
          } catch (err) {
            Alert.alert("No se pudo quitar la foto", err.message);
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  // Valida el cambio de correo o contraseña. Devuelve { email?, newPassword? },
  // null si no hay cambio de acceso, o false si hay que corregir algo (ya avisado).
  const credentialsRequest = () => {
    if (!credentialsTouched) return null;
    const email = form.newEmail.trim().toLowerCase();
    const wantsEmail = Boolean(email) && email !== account.email;
    const wantsPassword = Boolean(form.newPassword);
    if (email && !wantsEmail) {
      Alert.alert("Revisa el correo", "El nuevo correo es igual al actual");
      return false;
    }
    if (!wantsEmail && !wantsPassword) {
      Alert.alert("Sin cambios", "Escribe el nuevo correo o la nueva contraseña, o descarta los cambios");
      return false;
    }
    if (wantsPassword && form.newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert("Revisa la contraseña", `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return false;
    }
    return { email: wantsEmail ? email : undefined, newPassword: wantsPassword ? form.newPassword : undefined };
  };

  // currentPassword: lo escrito en la hoja (solo hace falta si hay un cambio
  // de correo o contraseña).
  const handleSave = async (currentPassword) => {
    if (!dirty) return;
    if (profileDirty && !form.name.trim()) {
      Alert.alert("Revisa tu nombre", "Escribe tu nombre");
      return;
    }
    if (profileDirty && !form.lastName.trim()) {
      Alert.alert("Revisa tu apellido", "Escribe tu apellido");
      return;
    }
    if (profileDirty && form.dui && !isValidDui(form.dui)) {
      Alert.alert("DUI inválido", "El DUI debe tener 9 números (ej. 12345678-9)");
      return;
    }
    const credentials = credentialsRequest();
    if (credentials === false) return;
    if (credentials && !currentPassword) {
      setPrompt({ value: "", error: "" });
      return;
    }

    setSaving(true);
    try {
      // El cambio de acceso va primero: si la contraseña actual no es
      // correcta, falla aquí y no se guarda nada más.
      if (credentials) {
        let saved;
        try {
          saved = await cambiarAcceso({ ...credentials, currentPassword });
        } catch (err) {
          setPrompt((p) => ({ value: p?.value ?? "", error: err.message }));
          return;
        }
        setPrompt(null);
        if (saved?.email) updateUser({ email: saved.email });
        // La contraseña nueva: se vuelve a pedir la que se muestra y la de
        // esta sesión se actualiza (solo en memoria).
        if (credentials.newPassword) {
          setSessionPassword(credentials.newPassword);
          refreshStoredPassword();
        }
        // Ya aplicado: si falla algo después, reintentar no lo repite.
        setDraft((d) => (d ? { ...d, newEmail: "", newPassword: "" } : d));
      }
      if (profileDirty) {
        const saved = await guardarPerfil({ name: form.name.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(), dui: form.dui });
        // El nombre del usuario en sesión (cabecera del menú lateral).
        if (saved?.name) updateUser({ name: saved.name, lastName: saved.lastName });
      }
      setDraft(null);
      toast.show("Cambios guardados");
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    if (loading) return <LoadingState />;
    return <ErrorState message={error || "No se pudo cargar tu cuenta"} onRetry={refresh} />;
  }

  const role = roleLine(account);

  return (
    <View style={styles.screen}>
      <KeyboardScreen
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
              refreshStoredPassword();
            }}
          />
        }
      >
        <View style={styles.profile}>
          <Pressable
            onPress={() => setPhotoSheet(true)}
            disabled={photoBusy}
            accessibilityRole="button"
            accessibilityLabel={photoOf(account) ? "Cambiar foto de perfil" : "Subir foto de perfil"}
          >
            <Avatar name={fullName(account)} photoUrl={photoOf(account)} tone={personTone(account)} size={80} />
            {photoBusy ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={14} color={colors.white} />
            </View>
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {fullName(account)}
            </Text>
            <Text style={styles.role} numberOfLines={1}>
              {role || "Sin puesto asignado"}
            </Text>
            <PermissionChip employee={account} style={styles.chip} />
          </View>
        </View>

        <Card>
          <Text style={type.overline}>Correo con el que inicias sesión</Text>
          <Text style={styles.email} numberOfLines={1}>
            {account.email}
          </Text>
        </Card>

        <View style={styles.columns}>
          <FormField
            label="Nombre"
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            autoComplete="given-name"
            maxLength={60}
            style={styles.flex}
          />
          <FormField
            label="Apellido"
            value={form.lastName}
            onChangeText={(v) => setField("lastName", v)}
            autoComplete="family-name"
            maxLength={60}
            style={styles.flex}
          />
        </View>

        <FormField
          label="Cambiar correo"
          value={form.newEmail}
          onChangeText={(v) => setField("newEmail", v)}
          placeholder="Nuevo correo"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="off"
        />
        {/* Fija, como el correo; si el backend no la puede descifrar (hash
            viejo), se usa la escrita al iniciar esta sesión. */}
        <CurrentPasswordField
          password={storedPassword?.password || (storedPassword?.legacy ? sessionPassword : "") || ""}
          legacy={Boolean(storedPassword?.legacy)}
        />
        <PasswordField
          label="Cambiar contraseña"
          value={form.newPassword}
          onChangeText={(v) => setField("newPassword", v)}
          placeholder={`Nueva contraseña (mín. ${MIN_PASSWORD_LENGTH})`}
          autoComplete="new-password"
          note="Al guardar un correo o una contraseña nuevos se te pide tu contraseña actual."
        />

        <View style={styles.columns}>
          <FormField
            label="Teléfono"
            value={form.phone}
            onChangeText={(v) => setField("phone", v)}
            placeholder="2222-2222"
            keyboardType="phone-pad"
            style={styles.flex}
          />
          <FormField
            label="DUI"
            value={form.dui}
            onChangeText={(v) => setField("dui", v)}
            placeholder="12345678-9"
            keyboardType="number-pad"
            maxLength={10}
            style={styles.flex}
          />
        </View>
      </KeyboardScreen>

      <BottomBar
        actions={
          dirty
            ? [
                { title: "Descartar", variant: "secondary", disabled: saving, onPress: () => setDraft(null) },
                { title: "Guardar cambios", loading: saving && !prompt, onPress: () => handleSave() },
              ]
            : [{ title: "Guardar cambios", disabled: true }]
        }
      />

      <PhotoSheet
        visible={photoSheet}
        hasPhoto={Boolean(photoOf(account))}
        onClose={() => setPhotoSheet(false)}
        onCamera={() => changePhoto("camera")}
        onLibrary={() => changePhoto("library")}
        onRemove={removePhoto}
      />

      <ConfirmPasswordSheet
        state={prompt}
        busy={saving}
        onChange={(value) => setPrompt((p) => ({ ...p, value, error: "" }))}
        onClose={() => setPrompt(null)}
        onConfirm={(password) => handleSave(password)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  name: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  role: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  chip: { marginTop: 6 },
  email: { marginTop: 4, fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  columns: { flexDirection: "row", gap: 10 },
  sheetFooter: { flexDirection: "row", gap: 10 },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  options: { gap: 4, paddingBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 },
  optionPressed: { backgroundColor: colors.surface2 },
  optionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
