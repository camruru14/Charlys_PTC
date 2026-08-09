import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import Modal from "../components/ui/Modal";
import { Field } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconSettings, IconBox, IconPlus } from "../lib/icons";

// Datos de la empresa: todavía no hay un modelo/endpoint dedicado en el
// backend para esto (solo se pidió el de Bodegas), así que por ahora se
// guardan localmente en el navegador. El día que se necesite compartirlos
// entre usuarios, esto pasa a un endpoint real sin cambiar la forma del form.
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
  const { data, loading, error, refetch } = useFetch("/warehouses");
  const list = Array.isArray(data) ? data : [];

  const [company, setCompany] = useState(loadCompany);
  const [savingCompany, setSavingCompany] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

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
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(w) {
    if (!window.confirm(`¿Eliminar la bodega "${w.name}"? Los artículos que ya la tengan asignada no se ven afectados, pero no se podrá elegir de nuevo.`))
      return;
    try {
      await api.del(`/warehouses/${w._id}`);
      toast.success("Bodega eliminada");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Bodegas configuradas" value={list.length} icon={IconBox} trend={{ tone: "blue", label: "activas" }} />
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
        <AsyncState loading={loading} error={error} empty={!loading && list.length === 0} emptyText="No hay bodegas registradas.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Bodega</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((w) => (
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
    </div>
  );
}

export default Configuracion;
