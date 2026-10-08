import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useApi } from "../hooks/useApi";
import { useVehicles } from "../hooks/useVehicles";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import ListGroup, { ListRow } from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import VehiclePhoto from "../components/ui/VehiclePhoto";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatClock, formatDateTime } from "../lib/format";
import { routeLabel } from "../lib/logistics";
import { pickPhotoSource } from "../lib/pickImages";
import { statusTone } from "../lib/statusTones";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_MODEL_LENGTH = 60;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Configuración > Vehículos > un vehículo (lista y detalle de Configuracion.jsx
// de la web), para crear (sin `id`) y editar. La foto de un vehículo existente
// se sube y se quita al momento; la de uno nuevo es una vista previa que se
// sube justo después de crearlo. Un vehículo en una ruta sin completar no se
// elimina ni cambia de placa.
export default function VehiculoDetalleScreen({ navigation, route: navRoute }) {
  const toast = useToast();
  const id = navRoute.params?.id;
  const isNew = !id;
  const { vehicles, loading, error, refresh, crear, actualizar, eliminar, subirFoto, quitarFoto } = useVehicles();
  const { data: availability } = useApi("/routes/availability");

  const [draft, setDraft] = useState(null); // { model, plate } | null (sin cambios)
  const [pending, setPending] = useState(null); // archivo elegido para un vehículo nuevo
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  // Al guardar o eliminar se vuelve a la lista: la guarda de «cambios sin
  // guardar» no debe aparecer en el camino, y mientras se elimina se sigue
  // mostrando el vehículo (la lista ya no lo trae) en vez de «ya no existe».
  const leaving = useRef(false);
  const [deleted, setDeleted] = useState(null);

  const vehicle = (isNew ? null : vehicles.find((v) => v._id === id)) || deleted;

  const usage = vehicle ? (availability?.vehicles || []).find((v) => String(v._id) === String(vehicle._id)) : null;
  const route = usage?.busy ? usage.route : null;
  const locked = Boolean(route);

  const saved = { model: vehicle?.model || "", plate: vehicle?.plate || "" };
  const form = draft ?? saved;
  const cleanModel = form.model.trim();
  const cleanPlate = form.plate.trim();
  const valid = Boolean(cleanModel) && Boolean(cleanPlate);
  const changed = isNew || cleanModel !== saved.model || cleanPlate !== saved.plate;
  const dirty = isNew ? Boolean(draft || pending) : changed;
  const photoUri = isNew ? pending?.uri : vehicle?.image?.url;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew ? "Nuevo vehículo" : vehicle?.model || "Sin modelo",
      headerStatus: vehicle
        ? {
            label: route ? `En ruta · ${routeLabel(route)}` : "Disponible",
            tone: statusTone(route ? "En ruta" : "Disponible", "vehiculo"),
          }
        : undefined,
    });
  }, [navigation, isNew, vehicle, route]);

  // Salir con cambios sin guardar: se pregunta antes.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dirty || saving || leaving.current) return;
        e.preventDefault();
        Alert.alert("Cambios sin guardar", "¿Salir sin guardar los cambios del vehículo?", [
          { text: "Seguir editando", style: "cancel" },
          { text: "Descartar", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty, saving],
  );

  const setField = (field, value) => setDraft({ ...form, [field]: value });

  const changePhoto = async () => {
    const file = (await pickPhotoSource(1))?.[0];
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) return Alert.alert("Foto", "La foto debe ser una imagen");
    if (file.size && file.size > MAX_PHOTO_BYTES) return Alert.alert("Foto", "La imagen no puede pesar más de 5 MB");
    const upload = { uri: file.uri, name: file.name, type: file.type };
    if (isNew) {
      setPending(upload);
      return;
    }
    setPhotoBusy(true);
    try {
      await subirFoto(vehicle._id, upload);
      toast.show("Foto actualizada");
    } catch (err) {
      Alert.alert("No se pudo subir la foto", err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () =>
    Alert.alert("Quitar foto", "¿Quitar la foto de este vehículo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: async () => {
          if (isNew) return setPending(null);
          setPhotoBusy(true);
          try {
            await quitarFoto(vehicle._id);
            toast.show("Foto quitada");
          } catch (err) {
            Alert.alert("No se pudo quitar la foto", err.message);
          } finally {
            setPhotoBusy(false);
          }
          return undefined;
        },
      },
    ]);

  const handleSave = async () => {
    if (!valid) return Alert.alert("Falta información", cleanModel ? "Escribe la placa del vehículo" : "Escribe el modelo del vehículo");
    if (!changed || saving) return undefined;
    setSaving(true);
    try {
      if (isNew) {
        const created = await crear({ plate: cleanPlate, model: cleanModel });
        if (pending && created?._id) {
          try {
            await subirFoto(created._id, pending);
          } catch (err) {
            Alert.alert("Falta la foto", `El vehículo se creó, pero no se pudo subir la foto: ${err.message}`);
          }
        }
        toast.show("Vehículo agregado");
      } else {
        const body = {};
        if (cleanModel !== saved.model) body.model = cleanModel;
        if (cleanPlate !== saved.plate) body.plate = cleanPlate;
        await actualizar(vehicle._id, body);
        toast.show("Vehículo actualizado");
      }
      leaving.current = true;
      navigation.goBack();
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const confirmDelete = () =>
    Alert.alert("Eliminar vehículo", `¿Eliminar el vehículo «${vehicle.plate}»? Ya no se podrá elegir al armar rutas.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          leaving.current = true;
          setDeleted(vehicle);
          try {
            await eliminar(vehicle._id);
            toast.show("Vehículo eliminado");
            navigation.goBack();
          } catch (err) {
            leaving.current = false;
            setDeleted(null);
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);

  if (!isNew && !vehicle) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Este vehículo ya no existe." />;
  }

  const departed = route?.departedAt ? new Date(route.departedAt) : null;
  const departedText = departed ? (sameDay(departed, new Date()) ? formatClock(departed) : formatDateTime(departed)) : "Todavía no sale";

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <View>
          <VehiclePhoto uri={photoUri} iconSize={64} style={styles.photo} />
          {photoBusy ? (
            <View style={styles.photoBusy}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>
        <View style={styles.photoActions}>
          <Button title="Cambiar foto" icon="camera" variant="secondary" size="small" disabled={photoBusy || saving} onPress={changePhoto} />
          {photoUri ? <Button title="Quitar" variant="secondary" size="small" disabled={photoBusy || saving} onPress={removePhoto} /> : null}
        </View>
        <Text style={styles.help}>JPG, PNG o WEBP · máximo 5 MB</Text>

        <FormField
          label="Modelo"
          value={form.model}
          onChangeText={(v) => setField("model", v)}
          placeholder="Ej. Isuzu NPR 2019"
          maxLength={MAX_MODEL_LENGTH}
          required
        />
        <FormField
          label="Placa"
          value={form.plate}
          onChangeText={(v) => setField("plate", v.toUpperCase())}
          placeholder="Ej. P123-456"
          autoCapitalize="characters"
          editable={!locked}
          required
        />

        {!isNew ? (
          <>
            <Text style={[type.overline, styles.sectionTitle]}>Uso actual</Text>
            {route ? (
              <ListGroup>
                <ListRow title="Ruta" value={`${routeLabel(route)}${route.zone ? ` · ${route.zone}` : ""}`} />
                <ListRow title="Motorista" value={route.driverName || "Sin motorista"} />
                <ListRow title="Salió" value={departedText} />
              </ListGroup>
            ) : (
              <ListGroup>
                <ListRow title="Disponible" subtitle="No está en ninguna ruta activa" />
              </ListGroup>
            )}
          </>
        ) : null}

        {locked ? (
          <View style={styles.warning}>
            <Icon name="alert" size={15} color={colors.amberStrong} />
            <Text style={styles.warningText}>
              No se puede eliminar ni cambiar la placa mientras esté en una ruta activa. Queda libre al completar la ruta.
            </Text>
          </View>
        ) : null}
      </KeyboardScreen>

      <BottomBar
        actions={[
          isNew
            ? { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() }
            : { title: "Eliminar", variant: "danger", disabled: locked || saving, onPress: confirmDelete },
          { title: "Guardar", loading: saving, disabled: !valid || !changed, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  photo: { width: "100%", aspectRatio: 16 / 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  help: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 18 },
  sectionTitle: { marginTop: 4, marginBottom: 8 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: tones.amber.bg,
    borderWidth: 1,
    borderColor: colors.amberLine,
    borderRadius: 12,
    padding: 13,
  },
  warningText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.amberStrong },
});
