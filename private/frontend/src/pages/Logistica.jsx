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

// Mismo estilo que los filtros de Inventario, para que ambas barras de
// filtros se vean iguales en todo el panel.
const selectFilterClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-brand-400";

// Al menos una línea ya empacada (en Almacén o Fabricación, ver
// packedLocation en Order.js): con eso basta para que Logística pueda
// asignar motorista, aunque el pedido no esté "Empacado" completo todavía
// (order.status solo llega a "Empacado" cuando TODAS las líneas lo están).
function hasPackedItems(order) {
  return (order.items || []).some((i) => i.packed);
}

// Ubicaciones donde el pedido tiene algo empacado esperando a que el
// motorista lo recoja: "Almacén" si algún item se empacó desde Inventario >
// Pedidos, "Fabricación" si algún item se empacó desde Fabricación >
// Fabricación de pedidos. Un pedido puede requerir una sola parada o las dos.
function getRequiredPickups(order) {
  const items = order.items || [];
  const locations = [];
  if (items.some((i) => i.packedLocation === "Almacén")) locations.push("Almacén");
  if (items.some((i) => i.packedLocation === "Fabricación")) locations.push("Fabricación");
  return locations;
}

// Fecha en que Logística confirmó la recolección en esa ubicación (o
// undefined si todavía no).
function pickupDateFor(order, location) {
  return location === "Almacén" ? order.delivery?.pickupWarehouseAt : order.delivery?.pickupFactoryAt;
}

// Ya tiene motorista pero todavía le falta pasar a recoger algo: se muestra
// "Recolectando" en vez del estado normal. Solo visual, no es un valor nuevo
// en la base de datos.
function isCollecting(order) {
  if (!order.delivery?.driver) return false;
  return getRequiredPickups(order).some((loc) => !pickupDateFor(order, loc));
}

function Logistica() {
  const { data: orders, loading, error, refetch } = useFetch("/orders");
  const { data: employees } = useFetch("/employees");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  // Se guarda el id, no el objeto, así el modal "Editar entrega" (paradas de
  // recolección incluidas) siempre refleja el estado más reciente tras
  // confirmar una recolección, sin tener que cerrarlo y reabrirlo.
  const [targetId, setTargetId] = useState(null);
  const [form, setForm] = useState({ driver: "", vehicle: "", address: "" });
  const [editForm, setEditForm] = useState({ driver: "", vehicle: "", address: "", dispatchStatus: "Saliendo" });
  const [saving, setSaving] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState("");

  const [filterDriver, setFilterDriver] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const list = Array.isArray(orders) ? orders : [];
  const drivers = (Array.isArray(employees) ? employees : []).filter((e) => e.role === "motorista");

  // Pedido con el modal "Editar entrega"/"Asignar" abierto, recalculado de
  // `list` en cada render (igual que pedidoInfoOrder en Inventario.jsx).
  const target = useMemo(() => list.find((o) => o._id === targetId) || null, [list, targetId]);

  // Pedidos relevantes para logística: con al menos un producto ya empacado
  // (aunque el pedido no esté "Empacado" completo — así se puede asignar
  // motorista apenas el primer producto quede listo, sin esperar al resto)
  // o ya en ciclo de despacho activo.
  const shipping = list.filter((o) => hasPackedItems(o) || ["En Tránsito", "Entregado"].includes(o.status));

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

  // Opciones de filtro derivadas de los pedidos en despacho, para no mostrar
  // motoristas/vehículos/estados que no aparecen en la lista.
  const shippingDrivers = useMemo(() => {
    const map = new Map();
    shipping.forEach((o) => {
      const d = o.delivery?.driver;
      if (d && typeof d === "object" && d._id) map.set(d._id, d);
    });
    return Array.from(map.values());
  }, [shipping]);

  const shippingVehicles = useMemo(() => {
    const set = new Set();
    shipping.forEach((o) => {
      if (o.delivery?.vehicle) set.add(o.delivery.vehicle);
    });
    return Array.from(set).sort();
  }, [shipping]);

  const shippingStatuses = useMemo(() => {
    const set = new Set();
    shipping.forEach((o) => set.add(o.delivery?.dispatchStatus || o.status));
    return Array.from(set);
  }, [shipping]);

  const filteredShipping = useMemo(() => {
    return shipping.filter((o) => {
      if (filterDriver) {
        const id = typeof o.delivery?.driver === "object" ? o.delivery?.driver?._id : o.delivery?.driver;
        if (id !== filterDriver) return false;
      }
      if (filterVehicle && o.delivery?.vehicle !== filterVehicle) return false;
      if (filterStatus && (o.delivery?.dispatchStatus || o.status) !== filterStatus) return false;
      return true;
    });
  }, [shipping, filterDriver, filterVehicle, filterStatus]);

  const hasActiveFilters = Boolean(filterDriver || filterVehicle || filterStatus);

  function clearFilters() {
    setFilterDriver("");
    setFilterVehicle("");
    setFilterStatus("");
  }

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
    setTargetId(o._id);
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
    setTargetId(o._id);
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

  // Confirma que el motorista ya recogió lo que le tocaba en esa ubicación
  // (checklist de "Paradas de recolección" del modal "Editar entrega").
  async function handleConfirmPickup(location) {
    if (!target) return;
    setConfirmingPickup(location);
    try {
      await api.patch(`/orders/${target._id}/delivery/pickup`, { location });
      toast.success(`Recolección en ${location} confirmada`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmingPickup("");
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className={selectFilterClass}
            >
              <option value="">Motoristas: Todos</option>
              {shippingDrivers.map((d) => (
                <option key={d._id} value={d._id}>{d.name} {d.lastName}</option>
              ))}
            </select>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className={selectFilterClass}
            >
              <option value="">Vehículos: Todos</option>
              {shippingVehicles.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={selectFilterClass}
            >
              <option value="">Estado: Todos</option>
              {shippingStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <AsyncState
            loading={loading}
            error={error}
            empty={!loading && filteredShipping.length === 0}
            emptyText={hasActiveFilters ? "Ningún pedido coincide con los filtros." : "No hay pedidos para despachar."}
          >
            <div className="max-h-96 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-3 pr-4 font-semibold">Pedido</th>
                      <th className="pb-3 pr-4 font-semibold">Motorista</th>
                      <th className="pb-3 pr-4 font-semibold">Vehículo</th>
                      <th className="pb-3 pr-4 font-semibold">Zona</th>
                      <th className="pb-3 pr-4 font-semibold">Paradas</th>
                      <th className="pb-3 pr-4 font-semibold">Estado</th>
                      <th className="pb-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShipping.map((o) => {
                      const pickups = getRequiredPickups(o);
                      return (
                        <tr key={o._id} className="text-slate-600 transition hover:bg-slate-50/60">
                          <td className="py-3 pr-4 font-semibold text-slate-800">{o.orderNumber}</td>
                          <td className="py-3 pr-4">{o.delivery?.driver ? `${o.delivery.driver.name} ${o.delivery.driver.lastName}` : "— sin asignar"}</td>
                          <td className="py-3 pr-4 tabular-nums">{o.delivery?.vehicle || "—"}</td>
                          <td className="py-3 pr-4">{o.delivery?.address || o.customer?.address || "—"}</td>
                          <td className="py-3 pr-4">
                            {pickups.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {pickups.map((loc) => {
                                  const done = Boolean(pickupDateFor(o, loc));
                                  return (
                                    <span
                                      key={loc}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {done ? <IconCheck width={12} height={12} /> : null}
                                      {loc}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {isCollecting(o) ? (
                              <StatusPill status="Recolectando" />
                            ) : o.delivery?.dispatchStatus ? (
                              <StatusPill status={o.delivery.dispatchStatus} />
                            ) : (
                              <StatusPill status={o.status} />
                            )}
                          </td>
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
                      );
                    })}
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

        {/* Checklist de recolección: dónde tiene que pasar el motorista antes
            de salir donde el cliente. Solo aparecen las ubicaciones que este
            pedido realmente necesita (ver getRequiredPickups). */}
        {target && getRequiredPickups(target).length > 0 ? (
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <span className="block text-sm font-medium text-slate-700">Paradas de recolección</span>
            {getRequiredPickups(target).map((loc) => {
              const count = (target.items || []).filter((i) => i.packedLocation === loc).length;
              const pickedUpAt = pickupDateFor(target, loc);
              return (
                <div key={loc} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                  <span className="text-slate-600">
                    <strong className="font-semibold text-slate-800">{loc}</strong> · {count} producto{count === 1 ? "" : "s"}
                  </span>
                  {pickedUpAt ? (
                    <StatusPill status="Recogido" tone="green" />
                  ) : (
                    <button
                      onClick={() => handleConfirmPickup(loc)}
                      disabled={confirmingPickup === loc}
                      className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {confirmingPickup === loc ? "Confirmando…" : "Confirmar recogido"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default Logistica;
