import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import DonutChart from "../components/ui/DonutChart";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconTruck, IconCheck, IconAlert, IconOrders } from "../lib/icons";

const DISPATCH = ["Saliendo", "A tiempo", "Demorado", "Entregado"];

function Logistica() {
  const { data: orders, loading, error, refetch } = useFetch("/orders");
  const { data: employees } = useFetch("/employees");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ driver: "", vehicle: "", address: "" });
  const [editForm, setEditForm] = useState({ driver: "", vehicle: "", address: "", dispatchStatus: "Saliendo" });
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(orders) ? orders : [];
  const drivers = (Array.isArray(employees) ? employees : []).filter((e) => e.role === "motorista");

  // Pedidos relevantes para logística (empacados o ya en ruta)
  const shipping = list.filter((o) => ["Empacado", "En Tránsito", "Entregado"].includes(o.status));

  // Motoristas ocupados: mapa motorista -> pedido, solo para pedidos activamente en despacho
  // (Empacado / En Tránsito). Se usa "shipping" en vez de "list" para no marcar como ocupado
  // a un motorista por un delivery.driver viejo de un pedido que ya no está en reparto.
  const busyDriverMap = useMemo(() => {
    const map = new Map();
    shipping.forEach((o) => {
      if (o.status === "Entregado" || !o.delivery?.driver) return;
      const id = typeof o.delivery.driver === "string" ? o.delivery.driver : o.delivery.driver._id;
      if (id) map.set(id, o._id);
    });
    return map;
  }, [shipping]);

  const availableDrivers = useMemo(
    () => drivers.filter((d) => !busyDriverMap.has(d._id)),
    [drivers, busyDriverMap]
  );

  // Para el modal de asignación: disponibles + el motorista ya asignado al pedido que se está editando (para poder reasignarlo)
  const selectableDrivers = useMemo(
    () => drivers.filter((d) => {
      const busyOrderId = busyDriverMap.get(d._id);
      return !busyOrderId || busyOrderId === target?._id;
    }),
    [drivers, busyDriverMap, target]
  );

  const kpis = useMemo(() => {
    const inTransit = list.filter((o) => o.status === "En Tránsito").length;
    const onTime = list.filter((o) => o.delivery?.dispatchStatus === "A tiempo").length;
    const delayed = list.filter((o) => o.delivery?.dispatchStatus === "Demorado").length;
    const total = inTransit + list.filter((o) => o.status === "Entregado").length;
    const punctuality = total ? Math.round(((total - delayed) / total) * 100) : 100;
    return { inTransit, onTime, delayed, punctuality, drivers: drivers.length };
  }, [list, drivers.length]);

  const statusMix = useMemo(() => {
    const onTime = shipping.filter((o) => o.delivery?.dispatchStatus === "A tiempo").length;
    const transit = shipping.filter((o) => ["Saliendo"].includes(o.delivery?.dispatchStatus)).length;
    const delayed = shipping.filter((o) => o.delivery?.dispatchStatus === "Demorado").length;
    return [
      { label: "A tiempo", value: onTime || 0, color: "#10b981" },
      { label: "Saliendo", value: transit || 0, color: "#f59e0b" },
      { label: "Demorado", value: delayed || 0, color: "#ef4444" },
    ];
  }, [shipping]);

  // Modal "Asignar": solo para pedidos que aún no tienen motorista. El estado de despacho
  // no se elige aquí, siempre queda en "Saliendo".
  function openAssign(o) {
    setTarget(o);
    setForm({ driver: "", vehicle: "", address: o.customer?.address || "" });
    setAssignModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleAssign(e) {
    e.preventDefault();
    if (!form.driver) return toast.error("Selecciona un motorista");
    setSaving(true);
    try {
      await api.patch(`/orders/${target._id}/delivery`, { ...form, dispatchStatus: "Saliendo" });
      toast.success(`Motorista asignado a ${target.orderNumber}`);
      setAssignModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Modal "Editar": para pedidos que ya tienen motorista asignado. Aquí sí se puede
  // ajustar el estado de despacho.
  function openEdit(o) {
    setTarget(o);
    setEditForm({
      driver: o.delivery?.driver?._id || o.delivery?.driver || "",
      vehicle: o.delivery?.vehicle || "",
      address: o.delivery?.address || o.customer?.address || "",
      dispatchStatus: o.delivery?.dispatchStatus || "Saliendo",
    });
    setEditModalOpen(true);
  }

  const handleEditChange = (e) => setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleEdit(e) {
    e.preventDefault();
    if (!editForm.driver) return toast.error("Selecciona un motorista");
    setSaving(true);
    try {
      await api.patch(`/orders/${target._id}/delivery`, editForm);
      toast.success(`Entrega de ${target.orderNumber} actualizada`);
      setEditModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Entregas en ruta" value={kpis.inTransit} icon={IconTruck} trend={{ tone: "blue", label: "En tránsito" }} />
        <KpiCard label="Tasa de puntualidad" value={`${kpis.punctuality}%`} icon={IconCheck} trend={{ tone: kpis.punctuality >= 90 ? "green" : "yellow", label: kpis.punctuality >= 90 ? "Buena" : "Revisar" }} />
        <KpiCard label="Motoristas" value={kpis.drivers} icon={IconOrders} trend={{ tone: "blue", label: "activos" }} />
        <KpiCard label="Entregas demoradas" value={kpis.delayed} icon={IconAlert} trend={{ tone: kpis.delayed ? "red" : "green", label: kpis.delayed ? "Atención" : "OK" }} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <SectionCard title="Pedidos para despacho" className="xl:col-span-2">
          <AsyncState loading={loading} error={error} empty={!loading && shipping.length === 0} emptyText="No hay pedidos para despachar.">
            <div className="max-h-96 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-3 pr-4 font-semibold">Pedido</th>
                      <th className="pb-3 pr-4 font-semibold">Motorista</th>
                      <th className="pb-3 pr-4 font-semibold">Vehículo</th>
                      <th className="pb-3 pr-4 font-semibold">Zona</th>
                      <th className="pb-3 pr-4 font-semibold">Estado</th>
                      <th className="pb-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shipping.map((o) => (
                      <tr key={o._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{o.orderNumber}</td>
                        <td className="py-3 pr-4">{o.delivery?.driver ? `${o.delivery.driver.name} ${o.delivery.driver.lastName}` : "— sin asignar"}</td>
                        <td className="py-3 pr-4 tabular-nums">{o.delivery?.vehicle || "—"}</td>
                        <td className="py-3 pr-4">{o.delivery?.address || o.customer?.address || "—"}</td>
                        <td className="py-3 pr-4">{o.delivery?.dispatchStatus ? <StatusPill status={o.delivery.dispatchStatus} /> : <StatusPill status={o.status} />}</td>
                        <td className="py-3 text-right">
                          {o.delivery?.driver ? (
                            <button onClick={() => openEdit(o)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                              Editar
                            </button>
                          ) : (
                            <button onClick={() => openAssign(o)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                              Asignar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </AsyncState>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Estado de entregas">
            <DonutChart data={statusMix} centerLabel={String(shipping.length)} />
          </SectionCard>

          <SectionCard title="Motoristas disponibles">
            <AsyncState loading={loading} empty={availableDrivers.length === 0} emptyText="Sin motoristas disponibles.">
              <ul className="space-y-2 text-sm">
                {availableDrivers.map((d) => (
                  <li key={d._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="font-medium text-slate-700">{d.name} {d.lastName}</span>
                    <span className="text-xs text-slate-400">{d.phone || "—"}</span>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </SectionCard>
        </div>
      </div>

      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Asignar entrega · ${target?.orderNumber || ""}`}
        footer={
          <>
            <button onClick={() => setAssignModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="assign-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Asignar"}</button>
          </>
        }
      >
        <form id="assign-form" onSubmit={handleAssign} className="space-y-4">
          <SelectField
            label="Motorista"
            name="driver"
            value={form.driver}
            onChange={handleChange}
            required
            placeholder="Selecciona un motorista"
            options={selectableDrivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` }))}
          />
          <Field label="Vehículo (placa)" name="vehicle" value={form.vehicle} onChange={handleChange} placeholder="P-000-XXX" />
          <Field label="Zona / dirección" name="address" value={form.address} onChange={handleChange} />
        </form>
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Editar entrega · ${target?.orderNumber || ""}`}
        footer={
          <>
            <button onClick={() => setEditModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="edit-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="edit-form" onSubmit={handleEdit} className="space-y-4">
          <SelectField
            label="Motorista"
            name="driver"
            value={editForm.driver}
            onChange={handleEditChange}
            required
            placeholder="Selecciona un motorista"
            options={selectableDrivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` }))}
          />
          <Field label="Vehículo (placa)" name="vehicle" value={editForm.vehicle} onChange={handleEditChange} placeholder="P-000-XXX" />
          <Field label="Zona / dirección" name="address" value={editForm.address} onChange={handleEditChange} />
          <SelectField label="Estado de despacho" name="dispatchStatus" value={editForm.dispatchStatus} onChange={handleEditChange} options={DISPATCH} />
        </form>
      </Modal>
    </div>
  );
}

export default Logistica;
