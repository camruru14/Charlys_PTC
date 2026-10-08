import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Modal from "../../components/ui/Modal";
import { Field, SelectField } from "../../components/ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { crewSelectOptions, routeLabel } from "../../lib/logistics";

/*
  Modal «Nueva ruta» (desde «Armar ruta»). Motorista y vehículo son
  opcionales al crear; son obligatorios para salir. Se monta solo mientras
  está abierto.
*/
function ModalNuevaRuta({ availability, onClose, onCreated }) {
  const [zone, setZone] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);

  const { drivers, vehicles } = crewSelectOptions(availability);

  async function submit(e) {
    e.preventDefault();
    if (!zone.trim()) return;
    setSaving(true);
    try {
      const route = await api.post("/routes", { zone: zone.trim(), driver: driver || undefined, vehicle: vehicle || undefined });
      toast.success(`${routeLabel(route)} creada`);
      onCreated(route);
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva ruta"
      subtitle={
        <>
          Se le asignará un código único <strong className="font-semibold text-ink">R-AAAA-NNNN</strong> al crearla
        </>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="new-route-form" disabled={saving || !zone.trim()} className={buttonClass("primary", "modal")}>
            Crear ruta
          </button>
        </>
      }
    >
      <form id="new-route-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Zona" name="zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ej. Zona Norte" required autoFocus />
        <div>
          <SelectField label="Motorista" name="driver" value={driver} onChange={(e) => setDriver(e.target.value)} options={drivers} placeholder="Selecciona…" />
          {drivers.length === 1 ? <p className="t-aux mt-1.5">No hay empleados activos del área Logística.</p> : null}
        </div>
        <div>
          <SelectField label="Vehículo" name="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} options={vehicles} placeholder="Selecciona…" />
          {vehicles.length === 1 ? <p className="t-aux mt-1.5">No hay vehículos en Configuración.</p> : null}
        </div>
        <p className="text-[11.5px] text-muted">
          Los pedidos se agregan después, uno por uno, desde <strong className="font-semibold text-ink-2">Para despacho</strong> con el botón
          «+ Ruta» en cada pedido listo.
        </p>
      </form>
    </Modal>
  );
}

export default ModalNuevaRuta;
