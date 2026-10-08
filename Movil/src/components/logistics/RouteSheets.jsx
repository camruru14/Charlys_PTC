import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import BottomSheet from "../ui/BottomSheet";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import PillSelector from "../ui/PillSelector";
import { FieldLabel } from "../ui/fieldStyles";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { crewOptions, routeLabel } from "../../lib/logistics";

function CrewPicker({ label, options, value, onChange, emptyText, disabled }) {
  return (
    <View style={styles.group}>
      <FieldLabel label={label} />
      {options.length ? (
        <PillSelector options={options} value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <Text style={styles.aux}>{emptyText}</Text>
      )}
    </View>
  );
}

const NO_DRIVERS = "No hay empleados activos del área Logística.";
const NO_VEHICLES = "No hay vehículos en Configuración.";

// «Nueva ruta» (ModalNuevaRuta.jsx de la web): zona obligatoria; motorista y
// vehículo opcionales al crear (son obligatorios para salir). Tocar de nuevo
// una píldora seleccionada la quita. `onCreate(body)` hace el POST /routes y
// devuelve la ruta creada.
export function NewRouteSheet({ visible, availability, onClose, onCreate }) {
  const [zone, setZone] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setZone("");
    setDriver("");
    setVehicle("");
  }, [visible]);

  const { drivers, vehicles } = crewOptions(availability);

  const submit = async () => {
    if (!zone.trim()) return;
    setSaving(true);
    try {
      await onCreate({ zone: zone.trim(), driver: driver || undefined, vehicle: vehicle || undefined });
    } catch (err) {
      Alert.alert("No se pudo crear la ruta", err.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissable={!saving}
      title="Nueva ruta"
      subtitle="Se le asignará un código único R-AAAA-NNNN al crearla"
      footer={
        <View style={styles.footer}>
          <Button title="Cancelar" variant="secondary" disabled={saving} onPress={onClose} style={styles.flex} />
          <Button
            title="Crear ruta"
            loading={saving}
            disabled={!zone.trim()}
            onPress={submit}
            style={styles.flex}
          />
        </View>
      }
    >
      <FormField label="Zona" value={zone} onChangeText={setZone} placeholder="Ej. Zona Norte" required />
      <CrewPicker
        label="Motorista"
        options={drivers}
        value={driver}
        onChange={(v) => setDriver(v === driver ? "" : v)}
        emptyText={NO_DRIVERS}
      />
      <CrewPicker
        label="Vehículo"
        options={vehicles}
        value={vehicle}
        onChange={(v) => setVehicle(v === vehicle ? "" : v)}
        emptyText={NO_VEHICLES}
      />
      <Text style={styles.note}>Después agregas los pedidos con «+ Ruta» desde la lista.</Text>
    </BottomSheet>
  );
}

// Reasignar motorista o vehículo de una ruta que todavía no sale (el modal
// «Motorista y vehículo» de ParaDespacho en la web): elegir una píldora solo
// cambia un borrador; nada se guarda hasta «Guardar», que hace un solo PATCH
// con lo que cambió y deja «Deshacer». Cerrar la hoja sin guardar descarta.
// `onSave({ driver?, vehicle? })` hace el PATCH y devuelve true si salió bien
// (si no, la hoja sigue abierta).
export function CrewSheet({ route, availability, busy, onClose, onSave }) {
  // Se conserva la última ruta para que la hoja se vea mientras se cierra.
  const last = useRef(route);
  if (route) last.current = route;
  const current = last.current;
  const open = Boolean(route);

  // Borrador { driver, vehicle }; null = sin cambios. Se descarta al abrir y al cerrar.
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    setDraft(null);
  }, [open]);

  const { drivers, vehicles } = crewOptions(availability, current?._id);
  const currentDriver = String(current?.driver?._id || current?.driver || "");
  const currentVehicle = current?.vehicle || "";
  const driverId = draft?.driver ?? currentDriver;
  const vehicleId = draft?.vehicle ?? currentVehicle;
  const changes = {};
  if (driverId !== currentDriver) changes.driver = driverId;
  if (vehicleId !== currentVehicle) changes.vehicle = vehicleId;
  const changed = Object.keys(changes).length > 0;

  const pick = (field, value) => setDraft({ driver: driverId, vehicle: vehicleId, [field]: value });

  const save = async () => {
    if (await onSave(changes)) onClose();
  };

  return (
    <BottomSheet
      visible={open}
      onClose={onClose}
      dismissable={!busy}
      title="Motorista y vehículo"
      subtitle={current ? `${routeLabel(current)} · ${current.zone}` : undefined}
      footer={
        <View style={styles.footer}>
          <Button title="Cancelar" variant="secondary" disabled={busy} onPress={onClose} style={styles.flex} />
          <Button title="Guardar" loading={busy} disabled={!changed} onPress={save} style={styles.flex} />
        </View>
      }
    >
      <CrewPicker
        label="Motorista"
        options={drivers}
        value={driverId}
        onChange={(v) => v !== driverId && pick("driver", v)}
        emptyText={NO_DRIVERS}
        disabled={busy}
      />
      <CrewPicker
        label="Vehículo"
        options={vehicles}
        value={vehicleId}
        onChange={(v) => v !== vehicleId && pick("vehicle", v)}
        emptyText={NO_VEHICLES}
        disabled={busy}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  aux: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 4 },
  footer: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
