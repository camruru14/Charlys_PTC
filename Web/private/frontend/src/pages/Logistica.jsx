import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField, FilterSelect } from "../components/ui/Field";
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

// Opciones de motorista/vehículo/estado presentes en una lista de pedidos
// (una por pestaña), para no mostrar en el filtro opciones que no aplican
// a lo que esa tabla está mostrando.
function driverOptionsFor(orders) {
  const map = new Map();
  orders.forEach((o) => {
    const d = o.delivery?.driver;
    if (d && typeof d === "object" && d._id) map.set(d._id, d);
  });
  return Array.from(map.values());
}

function vehicleOptionsFor(orders) {
  const set = new Set();
  orders.forEach((o) => {
    if (o.delivery?.vehicle) set.add(o.delivery.vehicle);
  });
  return Array.from(set).sort();
}

function statusOptionsFor(orders) {
  const set = new Set();
  orders.forEach((o) => set.add(o.delivery?.dispatchStatus || o.status));
  return Array.from(set);
}

function filterOrders(orders, { driver, vehicle, status }) {
  return orders.filter((o) => {
    if (driver) {
      const id = typeof o.delivery?.driver === "object" ? o.delivery?.driver?._id : o.delivery?.driver;
      if (id !== driver) return false;
    }
    if (vehicle && o.delivery?.vehicle !== vehicle) return false;
    if (status && (o.delivery?.dispatchStatus || o.status) !== status) return false;
    return true;
  });
}

function Logistica() {
  const { data: orders, loading, error, refetch } = useFetch("/orders");
  const { data: employees } = useFetch("/employees");
  const { data: vehiclesData } = useFetch("/vehicles");
  const vehicleOptions = (Array.isArray(vehiclesData) ? vehiclesData : []).map((v) => v.plate);
  // Si el vehículo ya guardado en el pedido no está (o ya no está) en
  // Configuración > Vehículos, se agrega igual a las opciones para no perder
  // ni ocultar el valor existente al editar.
  const vehicleOptionsWith = (value) => (value && !vehicleOptions.includes(value) ? [...vehicleOptions, value] : vehicleOptions);

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

  // "En Tránsito" primero: es lo que Logística revisa más seguido una vez el
  // pedido ya tiene motorista y todo recogido.
  const [activeTab, setActiveTab] = useState("transito");

  // Filtros de "Pedidos para despacho".
  const [filterDriver, setFilterDriver] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Filtros de "Pedidos en Tránsito", independientes de los de arriba.
  const [transitFilterDriver, setTransitFilterDriver] = useState("");
  const [transitFilterVehicle, setTransitFilterVehicle] = useState("");
  const [transitFilterStatus, setTransitFilterStatus] = useState("");

  const list = Array.isArray(orders) ? orders : [];
  // El sistema ya no maneja roles: los motoristas son los empleados del
  // Área "Logística" (ver Empleados.jsx).
  const drivers = (Array.isArray(employees) ? employees : []).filter((e) => e.department === "Logística");

  // Pedido con el modal "Editar entrega"/"Asignar" abierto, recalculado de
  // `list` en cada render (igual que pedidoInfoOrder en Inventario.jsx).
  const target = useMemo(() => list.find((o) => o._id === targetId) || null, [list, targetId]);

  // Pedidos relevantes para logística: con al menos un producto ya empacado
  // (aunque el pedido no esté "Empacado" completo — así se puede asignar
  // motorista apenas el primer producto quede listo, sin esperar al resto)
  // o ya en ciclo de despacho activo.
  const shipping = list.filter((o) => hasPackedItems(o) || ["En Tránsito", "Entregado"].includes(o.status));

  // Dentro de "shipping", qué pedidos van en cada pestaña. order.status ya es
  // la fuente de verdad (ver assignDelivery/confirmPickup en el backend):
  // solo llega a "En Tránsito"/"Entregado" cuando ya no le falta ninguna
  // parada de recolección, así que no hace falta volver a calcularlo acá.
  const dispatchOrders = useMemo(
    () => shipping.filter((o) => !["En Tránsito", "Entregado"].includes(o.status)),
    [shipping]
  );
  const transitOrders = useMemo(
    () => shipping.filter((o) => ["En Tránsito", "Entregado"].includes(o.status)),
    [shipping]
  );

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

  // Mismo patrón que busyDriverMap/availableDrivers pero por placa: un
  // vehículo cuenta como ocupado mientras esté en delivery.vehicle de un
  // pedido activamente en despacho (no "Entregado").
  const busyVehicleSet = useMemo(() => {
    const set = new Set();
    shipping.forEach((o) => {
      if (o.status === "Entregado" || !o.delivery?.vehicle) return;
      set.add(o.delivery.vehicle);
    });
    return set;
  }, [shipping]);

  const availableVehicles = useMemo(
    () => vehicleOptions.filter((plate) => !busyVehicleSet.has(plate)),
    [vehicleOptions, busyVehicleSet]
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
    return { inTransit, onTime, delayed };
  }, [list]);

  // Opciones y filtrado de "Pedidos para despacho", sobre dispatchOrders.
  const dispatchDrivers = useMemo(() => driverOptionsFor(dispatchOrders), [dispatchOrders]);
  const dispatchVehicles = useMemo(() => vehicleOptionsFor(dispatchOrders), [dispatchOrders]);
  const dispatchStatuses = useMemo(() => statusOptionsFor(dispatchOrders), [dispatchOrders]);

  const filteredDispatchOrders = useMemo(
    () => filterOrders(dispatchOrders, { driver: filterDriver, vehicle: filterVehicle, status: filterStatus }),
    [dispatchOrders, filterDriver, filterVehicle, filterStatus]
  );

  const hasActiveDispatchFilters = Boolean(filterDriver || filterVehicle || filterStatus);

  function clearDispatchFilters() {
    setFilterDriver("");
    setFilterVehicle("");
    setFilterStatus("");
  }

  // Opciones y filtrado de "Pedidos en Tránsito", sobre transitOrders — mismo
  // patrón, filtros independientes de los de arriba.
  const transitDrivers = useMemo(() => driverOptionsFor(transitOrders), [transitOrders]);
  const transitVehicles = useMemo(() => vehicleOptionsFor(transitOrders), [transitOrders]);
  const transitStatuses = useMemo(() => statusOptionsFor(transitOrders), [transitOrders]);

  const filteredTransitOrders = useMemo(
    () =>
      filterOrders(transitOrders, {
        driver: transitFilterDriver,
        vehicle: transitFilterVehicle,
        status: transitFilterStatus,
      }),
    [transitOrders, transitFilterDriver, transitFilterVehicle, transitFilterStatus]
  );

  const hasActiveTransitFilters = Boolean(transitFilterDriver || transitFilterVehicle || transitFilterStatus);

  function clearTransitFilters() {
    setTransitFilterDriver("");
    setTransitFilterVehicle("");
    setTransitFilterStatus("");
  }

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
        <KpiCard label="Motoristas disponibles" value={availableDrivers.length} icon={IconOrders} trend={{ tone: "blue", label: "libres" }} />
        <KpiCard label="Vehículos disponibles" value={availableVehicles.length} icon={IconTruck} trend={{ tone: "blue", label: "libres" }} />
        <KpiCard label="Entregas demoradas" value={kpis.delayed} icon={IconAlert} trend={{ tone: kpis.delayed ? "red" : "green", label: kpis.delayed ? "Atención" : "OK" }} />
      </div>

      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("transito")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "transito" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pedidos en Tránsito
        </button>
        <button
          onClick={() => setActiveTab("despacho")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "despacho" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pedidos para despacho
        </button>
      </div>

      <SectionCard title={activeTab === "transito" ? "Pedidos en Tránsito" : "Pedidos para despacho"}>
        {activeTab === "despacho" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FilterSelect
                value={filterDriver}
                onChange={(e) => setFilterDriver(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Motoristas: Todos" }, ...dispatchDrivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` }))]}
              />
              <FilterSelect
                value={filterVehicle}
                onChange={(e) => setFilterVehicle(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Vehículos: Todos" }, ...dispatchVehicles.map((v) => ({ value: v, label: v }))]}
              />
              <FilterSelect
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Estado: Todos" }, ...dispatchStatuses.map((s) => ({ value: s, label: s }))]}
              />
              {hasActiveDispatchFilters ? (
                <button
                  onClick={clearDispatchFilters}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
            <AsyncState
              loading={loading}
              error={error}
              empty={!loading && filteredDispatchOrders.length === 0}
              emptyText={hasActiveDispatchFilters ? "Ningún pedido coincide con los filtros." : "No hay pedidos para despachar."}
            >
              <div className="max-h-96 overflow-auto">
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
                    {filteredDispatchOrders.map((o) => {
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
                            {o.delivery?.driver ? (
                              <StatusPill status="Recolectando" />
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
            </AsyncState>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FilterSelect
                value={transitFilterDriver}
                onChange={(e) => setTransitFilterDriver(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Motoristas: Todos" }, ...transitDrivers.map((d) => ({ value: d._id, label: `${d.name} ${d.lastName}` }))]}
              />
              <FilterSelect
                value={transitFilterVehicle}
                onChange={(e) => setTransitFilterVehicle(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Vehículos: Todos" }, ...transitVehicles.map((v) => ({ value: v, label: v }))]}
              />
              <FilterSelect
                value={transitFilterStatus}
                onChange={(e) => setTransitFilterStatus(e.target.value)}
                className={selectFilterClass}
                options={[{ value: "", label: "Estado: Todos" }, ...transitStatuses.map((s) => ({ value: s, label: s }))]}
              />
              {hasActiveTransitFilters ? (
                <button
                  onClick={clearTransitFilters}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
            <AsyncState
              loading={loading}
              error={error}
              empty={!loading && filteredTransitOrders.length === 0}
              emptyText={hasActiveTransitFilters ? "Ningún pedido coincide con los filtros." : "No hay pedidos en tránsito."}
            >
              <div className="max-h-96 overflow-auto">
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
                    {filteredTransitOrders.map((o) => (
                      <tr key={o._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{o.orderNumber}</td>
                        <td className="py-3 pr-4">{o.delivery?.driver ? `${o.delivery.driver.name} ${o.delivery.driver.lastName}` : "— sin asignar"}</td>
                        <td className="py-3 pr-4 tabular-nums">{o.delivery?.vehicle || "—"}</td>
                        <td className="py-3 pr-4">{o.delivery?.address || o.customer?.address || "—"}</td>
                        <td className="py-3 pr-4">
                          {o.delivery?.dispatchStatus ? (
                            <StatusPill status={o.delivery.dispatchStatus} />
                          ) : (
                            <StatusPill status={o.status} />
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => openEdit(o)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AsyncState>
          </>
        )}
      </SectionCard>

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
          <SelectField
            label="Vehículo"
            name="vehicle"
            value={form.vehicle}
            onChange={handleChange}
            placeholder="Selecciona un vehículo"
            options={vehicleOptionsWith(form.vehicle)}
          />
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
          <SelectField
            label="Vehículo"
            name="vehicle"
            value={editForm.vehicle}
            onChange={handleEditChange}
            placeholder="Selecciona un vehículo"
            options={vehicleOptionsWith(editForm.vehicle)}
          />
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
