import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Modal from "../../components/ui/Modal";
import PillSelector from "../../components/ui/PillSelector";
import { Field } from "../../components/ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { personName } from "../../lib/logistics";

const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

/*
  Modal «Nueva ruta» (desde «Armar ruta»). Motorista y vehículo son
  opcionales al crear; son obligatorios para salir. Se monta solo mientras
  está abierto.
*/
function ModalNuevaRuta({ nextNumber, availability, onClose, onCreated }) {
  const [zone, setZone] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);

  const drivers = (availability?.drivers || []).map((d) => ({ value: d._id, label: personName(d), busy: d.busy }));
  const vehicles = (availability?.vehicles || []).map((v) => ({ value: v.plate, label: v.plate, busy: v.busy }));

  async function submit(e) {
    e.preventDefault();
    if (!zone.trim()) return;
    setSaving(true);
    try {
      const route = await api.post("/routes", { zone: zone.trim(), driver: driver || undefined, vehicle: vehicle || undefined });
      toast.success(`Ruta ${route.number} creada`);
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
          Se creará como <strong className="font-semibold text-ink">Ruta {nextNumber}</strong> · número asignado automáticamente
        </>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="new-route-form" disabled={saving || !zone.trim()} className={buttonClass("primary", "modal")}>
            Crear Ruta {nextNumber}
          </button>
        </>
      }
    >
      <form id="new-route-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Zona" name="zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ej. Zona Norte" required autoFocus />
        <div>
          <span className={labelClass}>Motorista</span>
          {drivers.length ? (
            <PillSelector options={drivers} value={driver} onChange={(v) => setDriver(v === driver ? "" : v)} />
          ) : (
            <p className="t-aux">No hay empleados activos del área Logística.</p>
          )}
        </div>
        <div>
          <span className={labelClass}>Vehículo</span>
          {vehicles.length ? (
            <PillSelector options={vehicles} value={vehicle} onChange={(v) => setVehicle(v === vehicle ? "" : v)} />
          ) : (
            <p className="t-aux">No hay vehículos en Configuración.</p>
          )}
        </div>
        <p className="text-[11.5px] text-muted">
          Los pedidos se agregan después, uno por uno, desde <strong className="font-semibold text-ink-2">Para despacho</strong> con el botón
          «+ Ruta {nextNumber}» en cada pedido listo.
        </p>
      </form>
    </Modal>
  );
}

export default ModalNuevaRuta;
