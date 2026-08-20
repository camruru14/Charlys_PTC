import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FormModal from "../ui/FormModal";
import FormField from "../ui/FormField";
import SegmentedField from "../ui/SegmentedField";
import Badge from "../ui/Badge";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";

const DISPATCH_STATUSES = ["Saliendo", "A tiempo", "Demorado", "Entregado"];

// Formulario chico de "Asignar entrega" / "Editar entrega" (Fase 4): mismo
// endpoint PATCH /orders/:id/delivery para ambos casos — asignar arranca
// vacío (dispatchStatus "Saliendo", dirección precargada con
// customer.address); editar precarga lo que ya tenía guardado el pedido.
//
// `pickups`/`onConfirmPickup`/`confirmingPickup` (Fase 9, opcionales): igual
// que el modal "Editar entrega" del panel web, el checklist de "Paradas de
// recolección" solo se muestra cuando el pedido YA tiene motorista asignado
// (isEditing) — no tiene sentido confirmar una recolección antes de que
// exista una entrega. PedidoDetalleScreen no pasa estas props (ya tiene su
// propio checklist en el cuerpo de la pantalla), así que su comportamiento
// no cambia.
export default function DeliveryFormModal({
  visible,
  order,
  drivers,
  vehicles,
  saving,
  onClose,
  onSave,
  pickups = [],
  onConfirmPickup,
  confirmingPickup = "",
}) {
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [dispatchStatus, setDispatchStatus] = useState("Saliendo");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!visible || !order) return;
    const existingDriver = order.delivery?.driver;
    setDriver((typeof existingDriver === "object" ? existingDriver?._id : existingDriver) || "");
    setVehicle(order.delivery?.vehicle || "");
    setDispatchStatus(order.delivery?.dispatchStatus || "Saliendo");
    setAddress(order.delivery?.address || order.customer?.address || "");
  }, [visible, order]);

  const isEditing = Boolean(order?.delivery?.driver);

  return (
    <FormModal
      visible={visible}
      title={isEditing ? "Editar entrega" : "Asignar entrega"}
      onClose={onClose}
      onSave={() => onSave({ driver, vehicle, dispatchStatus, address })}
      saving={saving}
      canSave={Boolean(driver)}
      saveLabel={isEditing ? "Guardar" : "Asignar"}
    >
      <SegmentedField
        label="Motorista"
        value={driver}
        options={drivers}
        getLabel={(d) => `${d.name} ${d.lastName}`}
        getValue={(d) => d._id}
        onChange={setDriver}
      />
      <SegmentedField
        label="Vehículo"
        value={vehicle}
        options={[{ plate: "", label: "Sin vehículo" }, ...vehicles.map((v) => ({ plate: v.plate, label: v.plate }))]}
        getLabel={(v) => v.label}
        getValue={(v) => v.plate}
        onChange={setVehicle}
      />
      <SegmentedField
        label="Estado de despacho"
        value={dispatchStatus}
        options={DISPATCH_STATUSES}
        onChange={setDispatchStatus}
      />
      <FormField label="Dirección" value={address} onChangeText={setAddress} />

      {isEditing && pickups.length > 0 ? (
        <View style={styles.pickupSection}>
          <Text style={styles.pickupTitle}>Paradas de recolección</Text>
          {pickups.map(({ location, count, done }) => (
            <View key={location} style={styles.pickupRow}>
              <Text style={styles.pickupText}>
                <Text style={styles.pickupLocation}>{location}</Text> · {count} producto{count === 1 ? "" : "s"}
              </Text>
              {done ? (
                <Badge label="Recogido" tone="green" />
              ) : (
                <MiniButton
                  label={confirmingPickup === location ? "Confirmando…" : "Confirmar recogido"}
                  onPress={() => onConfirmPickup?.(location)}
                  loading={confirmingPickup === location}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  pickupSection: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  pickupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.slate700,
    marginBottom: 8,
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickupText: {
    fontSize: 12,
    color: colors.slate500,
    flexShrink: 1,
    paddingRight: 8,
  },
  pickupLocation: {
    fontWeight: "700",
    color: colors.text,
  },
});
