import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconUsers, IconCheck, IconPlus } from "../lib/icons";

const ROLES = ["admin", "gerente", "operario", "motorista"];
const DEPARTMENTS = ["Fabricación", "Logística", "Administración", "Almacén", "Finanzas"];

// DUI se guarda como 9 dígitos; se muestra con guion antes del último dígito (8-1)
function formatDui(dui) {
  const digits = String(dui || "").replace(/\D/g, "");
  if (digits.length !== 9) return dui || "—";
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

const emptyForm = {
  name: "", lastName: "", dui: "", phone: "", email: "", password: "",
  role: "operario", position: "", department: "Fabricación", hourlyRate: "", isActive: true,
};

function Empleados() {
  const { data, loading, error, refetch } = useFetch("/employees");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(data) ? data : [];

  const kpis = useMemo(() => ({
    total: list.length,
    active: list.filter((e) => e.isActive !== false).length,
    drivers: list.filter((e) => e.role === "motorista").length,
    operators: list.filter((e) => e.role === "operario").length,
  }), [list]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditingId(emp._id);
    setForm({
      name: emp.name || "", lastName: emp.lastName || "", dui: emp.dui || "",
      phone: emp.phone || "", email: emp.email || "", password: "",
      role: emp.role || "operario", position: emp.position || "",
      department: emp.department || "Fabricación",
      hourlyRate: emp.hourlyRate ?? "", isActive: emp.isActive !== false,
    });
    setModalOpen(true);
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "dui") {
      setForm((f) => ({ ...f, dui: value.replace(/\D/g, "").slice(0, 9) }));
      return;
    }
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, hourlyRate: Number(form.hourlyRate) || 0 };
    if (editingId && !payload.password) delete payload.password; // no cambiar contraseña si va vacía
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, payload);
        toast.success("Empleado actualizado");
      } else {
        await api.post("/employees", payload);
        toast.success("Empleado creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(emp) {
    if (!window.confirm(`¿Eliminar a ${emp.name} ${emp.lastName}?`)) return;
    try {
      await api.del(`/employees/${emp._id}`);
      toast.success("Empleado eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Empleados" value={kpis.total} icon={IconUsers} trend={{ tone: "blue", label: "en planilla" }} />
        <KpiCard label="Activos" value={kpis.active} icon={IconCheck} trend={{ tone: "green", label: "trabajando" }} />
        <KpiCard label="Operarios" value={kpis.operators} icon={IconUsers} trend={{ tone: "blue", label: "Fabricación" }} />
        <KpiCard label="Motoristas" value={kpis.drivers} icon={IconUsers} trend={{ tone: "blue", label: "Logística" }} />
      </div>

      <SectionCard
        title="Personal"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Registrar empleado
          </button>
        }
      >
        <AsyncState loading={loading} error={error} empty={!loading && list.length === 0} emptyText="No hay empleados.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Nombre</th>
                  <th className="pb-3 pr-4 font-semibold">DUI</th>
                  <th className="pb-3 pr-4 font-semibold">Puesto</th>
                  <th className="pb-3 pr-4 font-semibold">Área</th>
                  <th className="pb-3 pr-4 font-semibold">Rol</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((emp) => (
                  <tr key={emp._id} className="text-slate-600 transition hover:bg-slate-50/60">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-800">{emp.name} {emp.lastName}</p>
                      <p className="text-xs text-slate-400">{emp.email}</p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{formatDui(emp.dui)}</td>
                    <td className="py-3 pr-4">{emp.position || "—"}</td>
                    <td className="py-3 pr-4">{emp.department || "—"}</td>
                    <td className="py-3 pr-4 capitalize">{emp.role}</td>
                    <td className="py-3 pr-4"><StatusPill status={emp.isActive !== false ? "Activo" : "Cancelado"} /></td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button onClick={() => openEdit(emp)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                        <button onClick={() => handleDelete(emp)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
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
        title={editingId ? "Editar empleado" : "Registrar empleado"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="emp-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="emp-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="name" value={form.name} onChange={handleChange} required />
          <Field label="Apellido" name="lastName" value={form.lastName} onChange={handleChange} required />
          <Field
            label="DUI"
            name="dui"
            value={form.dui}
            onChange={handleChange}
            inputMode="numeric"
            pattern="\d{9}"
            maxLength={9}
            placeholder="123456789"
            title="El DUI debe tener 9 números"
          />
          <Field label="Teléfono" name="phone" value={form.phone} onChange={handleChange} />
          <Field label="Correo" name="email" type="email" value={form.email} onChange={handleChange} required />
          <Field label={editingId ? "Contraseña (dejar vacío = sin cambio)" : "Contraseña"} name="password" type="password" value={form.password} onChange={handleChange} required={!editingId} />
          <SelectField label="Rol" name="role" value={form.role} onChange={handleChange} options={ROLES} />
          <Field label="Puesto" name="position" value={form.position} onChange={handleChange} />
          <SelectField label="Área" name="department" value={form.department} onChange={handleChange} options={DEPARTMENTS} />
          <Field label="Valor por hora ($)" name="hourlyRate" type="number" step="0.01" value={form.hourlyRate} onChange={handleChange} />
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 rounded border-slate-300" />
            Empleado activo
          </label>
        </form>
      </Modal>
    </div>
  );
}

export default Empleados;
