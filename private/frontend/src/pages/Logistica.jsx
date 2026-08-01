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

  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ driver: "", vehicle: "", dispatchStatus: "Saliendo", address: "" });
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(orders) ? orders : [];
  const drivers = (Array.isArray(employees) ? employees : []).filter((e) => e.role === "motorista");

  // Pedidos relevantes para logística (empacados o ya en ruta)
  const shipping = list.filter((o) => ["Empacado", "En Tránsito", "Entregado"].includes(o.status));

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

  function openAssign(o) {
    setTarget(o);
    setForm({
      driver: o.delivery?.driver?._id || o.delivery?.driver || "",
      vehicle: o.delivery?.vehicle || "",
      dispatchStatus: o.delivery?.dispatchStatus || "Saliendo",
      address: o.delivery?.address || o.customer?.address || "",
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleAssign(e) {
    e.preventDefault();
    if (!form.driver) return toast.error("Selecciona un motorista");
    setSaving(true);
    try {
      await api.patch(`/orders/${target._id}/delivery`, form);
      toast.success(`Motorista asignado a ${target.orderNumber}`);
      setModalOpen(false);
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Pedidos para despacho" className="xl:col-span-2">
          <AsyncState loading={loading} error={error} empty={!loading && shipping.length === 0} emptyText="No hay pedidos para despachar.">
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
                        <button onClick={() => openAssign(o)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                          {o.delivery?.driver ? "Reasignar" : "Asignar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Estado de entregas">
            <DonutChart data={statusMix} centerLabel={String(shipping.length)} />
          </SectionCard>

          <SectionCard title="Motoristas disponibles">
            <AsyncState loading={loading} empty={drivers.length === 0} emptyText="Sin motoristas registrados.">
              <ul className="space-y-2 text-sm">
                {drivers.map((d) => (
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Asignar entrega · ${target?.orderNumber || ""}`}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
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
            options={drivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` }))}
          />
          <Field label="Vehículo (placa)" name="vehicle" value={form.vehicle} onChange={handleChange} placeholder="P-000-XXX" />
          <Field label="Zona / dirección" name="address" value={form.address} onChange={handleChange} />
          <SelectField label="Estado de despacho" name="dispatchStatus" value={form.dispatchStatus} onChange={handleChange} options={DISPATCH} />
        </form>
      </Modal>
    </div>
  );
}

export default Logistica;
