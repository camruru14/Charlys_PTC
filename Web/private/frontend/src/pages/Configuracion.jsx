import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import KpiCard from "../components/ui/KpiCard";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { Field } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconSettings, IconBox, IconTruck, IconPlus } from "../lib/icons";

// Datos de la empresa: todavía no hay un modelo/endpoint dedicado en el
// backend para esto (solo se pidió el de Bodegas y el de Vehículos), así que
// por ahora se guardan localmente en el navegador. El día que se necesite
// compartirlos entre usuarios, esto pasa a un endpoint real sin cambiar la
// forma del form.
const COMPANY_STORAGE_KEY = "charly:company-info";
const emptyCompany = { name: "Industrias Charly", email: "", phone: "", address: "" };

function loadCompany() {
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    return raw ? { ...emptyCompany, ...JSON.parse(raw) } : emptyCompany;
  } catch {
    return emptyCompany;
  }
}

function Configuracion() {
  const { confirm, confirmProps } = useConfirm();
  const { data: warehousesData, loading: warehousesLoading, error: warehousesError, refetch: refetchWarehouses } = useFetch("/warehouses");
  const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

  const { data: vehiclesData, loading: vehiclesLoading, error: vehiclesError, refetch: refetchVehicles } = useFetch("/vehicles");
  const vehicles = Array.isArray(vehiclesData) ? vehiclesData : [];

  const [company, setCompany] = useState(loadCompany);
  const [savingCompany, setSavingCompany] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Mismo patrón que Bodegas, pero con su propio modal/estado (placa en vez
  // de nombre).
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [plate, setPlate] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);

  function handleCompanyChange(e) {
    setCompany((c) => ({ ...c, [e.target.name]: e.target.value }));
  }

  function handleCompanySubmit(e) {
    e.preventDefault();
    setSavingCompany(true);
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
    toast.success("Datos de la empresa guardados");
    setSavingCompany(false);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setModalOpen(true);
  }

  function openEdit(w) {
    setEditingId(w._id);
    setName(w.name || "");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/warehouses/${editingId}`, { name });
        toast.success("Bodega actualizada");
      } else {
        await api.post("/warehouses", { name });
        toast.success("Bodega agregada");
      }
      setModalOpen(false);
      refetchWarehouses();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(w) {
    if (!(await confirm(`¿Eliminar la bodega "${w.name}"? Los artículos que ya la tengan asignada no se ven afectados, pero no se podrá elegir de nuevo.`, { danger: true })))
      return;
    try {
      await api.del(`/warehouses/${w._id}`);
      toast.success("Bodega eliminada");
      refetchWarehouses();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openCreateVehicle() {
    setEditingVehicleId(null);
    setPlate("");
    setVehicleModalOpen(true);
  }

  function openEditVehicle(v) {
    setEditingVehicleId(v._id);
    setPlate(v.plate || "");
    setVehicleModalOpen(true);
  }

  async function handleVehicleSubmit(e) {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      if (editingVehicleId) {
        await api.put(`/vehicles/${editingVehicleId}`, { plate });
        toast.success("Vehículo actualizado");
      } else {
        await api.post("/vehicles", { plate });
        toast.success("Vehículo agregado");
      }
      setVehicleModalOpen(false);
      refetchVehicles();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingVehicle(false);
    }
  }

  async function handleDeleteVehicle(v) {
    if (!(await confirm(`¿Eliminar el vehículo "${v.plate}"? Los pedidos que ya lo tengan asignado no se ven afectados, pero no se podrá elegir de nuevo.`, { danger: true })))
      return;
    try {
      await api.del(`/vehicles/${v._id}`);
      toast.success("Vehículo eliminado");
      refetchVehicles();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Bodegas configuradas" value={warehouses.length} icon={IconBox} trend={{ tone: "blue", label: "activas" }} />
        <KpiCard label="Vehículos configurados" value={vehicles.length} icon={IconTruck} trend={{ tone: "blue", label: "activos" }} />
        <KpiCard label="Empresa" value={company.name || "—"} icon={IconSettings} trend={{ tone: "green", label: "configurado" }} />
      </div>

      <SectionCard title="Datos de la empresa">
        <form onSubmit={handleCompanySubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre de la empresa" name="name" value={company.name} onChange={handleCompanyChange} required />
          <Field label="Correo" name="email" type="email" value={company.email} onChange={handleCompanyChange} />
          <Field label="Teléfono" name="phone" value={company.phone} onChange={handleCompanyChange} />
          <Field label="Dirección" name="address" value={company.address} onChange={handleCompanyChange} />
          <div className="sm:col-span-2">
            <button type="submit" disabled={savingCompany} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {savingCompany ? "Guardando…" : "Guardar datos de la empresa"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Bodegas"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Agregar bodega
          </button>
        }
      >
        <p className="mb-4 text-sm text-slate-500">
          Estas son las bodegas disponibles en Inventario, en el modal de verificación de pedidos y en los reportes de Fabricación.
        </p>
        <AsyncState loading={warehousesLoading} error={warehousesError} empty={!warehousesLoading && warehouses.length === 0} emptyText="No hay bodegas registradas.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Bodega</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouses.map((w) => (
                  <tr key={w._id} className="text-slate-600 transition hover:bg-slate-50/60">
                    <td className="py-3 pr-4 font-semibold text-slate-800">{w.name}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button onClick={() => openEdit(w)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                        <button onClick={() => handleDelete(w)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </SectionCard>

      <SectionCard
        title="Vehículos"
        action={
          <button onClick={openCreateVehicle} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Agregar vehículo
          </button>
        }
      >
        <p className="mb-4 text-sm text-slate-500">
          Estos son los vehículos disponibles para elegir en Logística al asignar o editar una entrega.
        </p>
        <AsyncState loading={vehiclesLoading} error={vehiclesError} empty={!vehiclesLoading && vehicles.length === 0} emptyText="No hay vehículos registrados.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Placa</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((v) => (
                  <tr key={v._id} className="text-slate-600 transition hover:bg-slate-50/60">
                    <td className="py-3 pr-4 font-semibold text-slate-800">{v.plate}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button onClick={() => openEditVehicle(v)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                        <button onClick={() => handleDeleteVehicle(v)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar bodega" : "Agregar bodega"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="warehouse-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={handleSubmit}>
          <Field label="Nombre de la bodega" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bodega A-1" required />
        </form>
      </Modal>

      <Modal
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        title={editingVehicleId ? "Editar vehículo" : "Agregar vehículo"}
        footer={
          <>
            <button onClick={() => setVehicleModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="vehicle-form" disabled={savingVehicle} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{savingVehicle ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="vehicle-form" onSubmit={handleVehicleSubmit}>
          <Field label="Placa" name="plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="P-000-XXX" required />
        </form>
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Configuracion;
