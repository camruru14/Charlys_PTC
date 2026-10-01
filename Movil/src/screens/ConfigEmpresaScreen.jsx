import { useEffect, useState } from "react";
import { Alert, Image, RefreshControl, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { COMPANY_FIELDS, useCompanySettings } from "../hooks/useCompanySettings";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import DateField from "../components/ui/DateField";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import LoadingState from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { pickFromLibrary } from "../lib/pickImages";

// La app guardaba antes la ficha solo en el celular (AsyncStorage, misma
// clave que usaba la web en localStorage). Si el backend todavía no tiene
// ficha y el celular sí, esos datos se proponen como «Cambios sin guardar»,
// igual que hace la web con los datos viejos del navegador.
const LEGACY_COMPANY_KEY = "charly:company-info";
// El sistema solo maneja dólares: la moneda se muestra pero no se edita.
const CURRENCY_LABELS = { USD: "USD — dólar estadounidense" };
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

async function loadLegacyCompany() {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(LEGACY_COMPANY_KEY)) || "null");
    if (!parsed) return null;
    const picked = Object.fromEntries(COMPANY_FIELDS.map((k) => [k, typeof parsed[k] === "string" ? parsed[k] : ""]));
    return COMPANY_FIELDS.some((k) => picked[k]) ? picked : null;
  } catch {
    return null;
  }
}

const clearLegacyCompany = () => AsyncStorage.removeItem(LEGACY_COMPANY_KEY).catch(() => {});

function LogoTile({ url }) {
  if (url) return <Image source={{ uri: url }} style={[styles.logo, styles.logoImage]} resizeMode="contain" />;
  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <Text style={styles.logoText}>IC</Text>
    </View>
  );
}

// Configuración > Empresa: ficha de la empresa (/settings/company), logo
// (/settings/company/logo, se sube al momento) y horario laboral
// (/settings/work-schedule), con los mismos campos y validaciones que la web.
export default function ConfigEmpresaScreen({ navigation }) {
  const toast = useToast();
  const { company: saved, ready, error, refreshing, refresh, guardar, subirLogo } = useCompanySettings();
  const { schedule, loaded: scheduleLoaded, refresh: refreshSchedule } = useWorkSchedule();

  const [legacy, setLegacy] = useState(null);
  const [companyDraft, setCompanyDraft] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadLegacyCompany().then(setLegacy);
  }, []);

  // Ficha nunca guardada en el backend + datos viejos del celular.
  const pendingLegacy = ready && !saved.updatedAt ? legacy : null;
  const company = companyDraft ?? (pendingLegacy ? { ...saved, ...pendingLegacy } : saved);
  const scheduleForm = scheduleDraft ?? { startTime: schedule.startTime, workdayHours: String(schedule.workdayHours) };

  const companyDirty = ready && COMPANY_FIELDS.some((k) => (company[k] || "") !== (saved[k] || ""));
  const scheduleDirty =
    Boolean(scheduleDraft) &&
    (scheduleDraft.startTime !== schedule.startTime || Number(scheduleDraft.workdayHours) !== schedule.workdayHours);
  const dirty = companyDirty || scheduleDirty;

  const discard = () => {
    setCompanyDraft(null);
    setScheduleDraft(null);
    // Descartar también descarta los datos viejos del celular.
    if (pendingLegacy) {
      clearLegacyCompany();
      setLegacy(null);
    }
  };

  // Salir con cambios sin guardar: se pregunta antes.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dirty || saving) return;
        e.preventDefault();
        Alert.alert("Cambios sin guardar", "¿Salir sin guardar los cambios de la empresa?", [
          { text: "Seguir editando", style: "cancel" },
          { text: "Descartar", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty, saving],
  );

  const setCompanyField = (field, value) => setCompanyDraft({ ...company, [field]: value });
  const setScheduleField = (field, value) => setScheduleDraft({ ...scheduleForm, [field]: value });

  const handleSave = async () => {
    if (!company.name?.trim()) return Alert.alert("Falta información", "Escribe el nombre de la empresa");
    const hours = Number(scheduleForm.workdayHours);
    // Mismo rango y paso que el campo de la web (min 0.5, max 24, step 0.5).
    if (scheduleDirty && !(hours > 0 && hours <= 24 && Number.isInteger(hours * 2))) {
      return Alert.alert("Revisa la jornada", "Las horas de jornada deben ser mayores que 0 y hasta 24, en medias horas");
    }
    if (scheduleDirty && !scheduleForm.startTime) return Alert.alert("Falta información", "Elige la hora de entrada");

    setSaving(true);
    try {
      if (scheduleDirty) {
        await api.put("/settings/work-schedule", { startTime: scheduleForm.startTime, workdayHours: hours });
        await refreshSchedule();
      }
      if (companyDirty) {
        await guardar(company);
        clearLegacyCompany();
        setLegacy(null);
      }
      setCompanyDraft(null);
      setScheduleDraft(null);
      toast.show("Cambios guardados");
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  // El logo se sube y se guarda en el momento, sin pasar por «Guardar cambios».
  const changeLogo = async () => {
    const files = await pickFromLibrary(1);
    const file = files?.[0];
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) return Alert.alert("Logo", "El logo debe ser una imagen");
    if (file.size && file.size > MAX_LOGO_BYTES) return Alert.alert("Logo", "La imagen no puede pesar más de 5 MB");
    // Subir el logo crea la ficha en el backend: si había datos viejos del
    // celular pendientes, pasan al borrador para no perderlos.
    if (pendingLegacy && !companyDraft) setCompanyDraft(company);
    setUploadingLogo(true);
    try {
      await subirLogo({ uri: file.uri, name: file.name, type: file.type });
      toast.show("Logo actualizado");
    } catch (err) {
      Alert.alert("No se pudo subir el logo", err.message);
    } finally {
      setUploadingLogo(false);
    }
    return undefined;
  };

  if (!ready && !error) return <LoadingState />;

  const disabled = !ready;

  return (
    <View style={styles.screen}>
      <KeyboardScreen
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {dirty ? (
          <View style={styles.dirty}>
            <Icon name="alert" size={15} color={colors.amberStrong} />
            <Text style={styles.dirtyText}>Cambios sin guardar</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>No se pudo cargar la ficha de la empresa: {error}</Text> : null}

        <View style={styles.logoRow}>
          <LogoTile url={saved.logoUrl} />
          <Button
            title={uploadingLogo ? "Subiendo…" : "Cambiar logo"}
            variant="secondary"
            size="small"
            disabled={uploadingLogo || disabled}
            onPress={changeLogo}
          />
        </View>

        <FormField
          label="Nombre de la empresa"
          value={company.name}
          onChangeText={(v) => setCompanyField("name", v)}
          editable={!disabled}
          required
        />
        <FormField
          label="NIT"
          value={company.nit}
          onChangeText={(v) => setCompanyField("nit", v)}
          placeholder="0614-000000-000-0"
          editable={!disabled}
        />
        <View style={styles.columns}>
          <FormField
            label="Teléfono"
            value={company.phone}
            onChangeText={(v) => setCompanyField("phone", v)}
            keyboardType="phone-pad"
            editable={!disabled}
            style={styles.column}
          />
          <FormField
            label="Moneda"
            value={saved.currency === "USD" ? "USD" : CURRENCY_LABELS[saved.currency] || saved.currency}
            editable={false}
            style={styles.column}
          />
        </View>
        <FormField
          label="Correo de contacto"
          value={company.email}
          onChangeText={(v) => setCompanyField("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!disabled}
        />
        <FormField
          label="Dirección fiscal"
          value={company.address}
          onChangeText={(v) => setCompanyField("address", v)}
          editable={!disabled}
        />

        <Text style={[type.cardTitle, styles.sectionTitle]}>Horario laboral</Text>
        <Text style={styles.aux}>Se usa en Empleados para marcar las llegadas tarde y calcular las horas extra.</Text>
        <View style={styles.columns}>
          <DateField
            label="Hora de entrada"
            mode="time"
            value={scheduleForm.startTime}
            onChange={(v) => setScheduleField("startTime", v)}
            required
            style={styles.column}
          />
          <FormField
            label="Horas de jornada"
            value={scheduleForm.workdayHours}
            onChangeText={(v) => setScheduleField("workdayHours", v.replace(",", ".").replace(/[^\d.]/g, ""))}
            keyboardType="decimal-pad"
            editable={scheduleLoaded || Boolean(scheduleDraft)}
            required
            style={styles.column}
          />
        </View>
      </KeyboardScreen>

      {dirty ? (
        <BottomBar
          actions={[
            { title: "Descartar", variant: "secondary", disabled: saving, onPress: discard },
            { title: "Guardar cambios", icon: "check", loading: saving, onPress: handleSave },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  dirty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tones.amber.bg,
    borderWidth: 1,
    borderColor: colors.amberLine,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  dirtyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.amberStrong },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: tones.rose.text, marginBottom: 12 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  logoImage: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  logoFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  logoText: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.white },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
  sectionTitle: { marginTop: 8 },
  aux: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 12 },
});
