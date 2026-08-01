import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconBox, IconAlert, IconPlus } from "../lib/icons";

const CATEGORIES = ["Materia Prima", "Producto Terminado"];
const UNITS = ["kg", "unidad", "caja", "litro"];

const emptyForm = {
  name: "", category: "Materia Prima", type: "", color: "",
  unit: "kg", stock: "", minStock: "", unitCost: "", location: "",
};

function Inventario() {
  const { data, loading, error, refetch } = useFetch("/inventory");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(data) ? data : [];

  const kpis = useMemo(() => {
    const raw = list.filter((i) => i.category === "Materia Prima").length;
    const finished = list.filter((i) => i.category === "Producto Terminado").length;
    const low = list.filter((i) => i.minStock > 0 && i.stock <= i.minStock).length;
    const value = list.reduce((s, i) => s + (i.stock || 0) * (i.unitCost || 0), 0);
    return { raw, finished, low, value };
  }, [list]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "", category: item.category || "Materia Prima",
      type: item.type || "", color: item.color || "", unit: item.unit || "kg",
      stock: item.stock ?? "", minStock: item.minStock ?? "",
      unitCost: item.unitCost ?? "", location: item.location || "",
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      unitCost: Number(form.unitCost) || 0,
    };
    try {
      if (editingId) {
        await api.put(`/inventory/${editingId}`, payload);
        toast.success("Artículo actualizado");
      } else {
        await api.post("/inventory", payload);
        toast.success("Artículo agregado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`¿Eliminar ${item.name}?`)) return;
    try {
      await api.del(`/inventory/${item._id}`);
      toast.success("Artículo eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Materia prima" value={kpis.raw} icon={IconBox} trend={{ tone: "blue", label: "insumos" }} />
        <KpiCard label="Productos terminados" value={kpis.finished} icon={IconBox} trend={{ tone: "blue", label: "referencias" }} />
        <KpiCard label="Stock bajo" value={kpis.low} icon={IconAlert} trend={{ tone: kpis.low ? "yellow" : "green", label: kpis.low ? "Reponer" : "OK" }} />
        <KpiCard label="Valor del inventario" value={`$${kpis.value.toLocaleString("es-SV", { maximumFractionDigits: 0 })}`} icon={IconBox} trend={{ tone: "green", label: "estimado" }} />
      </div>

      <SectionCard
        title="Artículos en almacén"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Agregar artículo
          </button>
        }
      >
        <AsyncState loading={loading} error={error} empty={!loading && list.length === 0} emptyText="No hay artículos.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Artículo</th>
                  <th className="pb-3 pr-4 font-semibold">Categoría</th>
                  <th className="pb-3 pr-4 font-semibold">Existencia</th>
                  <th className="pb-3 pr-4 font-semibold">Ubicación</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((i) => {
                  const low = i.minStock > 0 && i.stock <= i.minStock;
                  return (
                    <tr key={i._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-800">{i.name}</p>
                        <p className="text-xs text-slate-400">{i.type}{i.color ? ` · ${i.color}` : ""}</p>
                      </td>
                      <td className="py-3 pr-4">{i.category}</td>
                      <td className="py-3 pr-4 tabular-nums">{(i.stock || 0).toLocaleString("es-SV")} {i.unit}</td>
                      <td className="py-3 pr-4">{i.location || "—"}</td>
                      <td className="py-3 pr-4"><StatusPill status={low ? "Alerta" : "Estable"} /></td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          <button onClick={() => openEdit(i)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                          <button onClick={() => handleDelete(i)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar artículo" : "Agregar artículo"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="inv-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="inv-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="name" value={form.name} onChange={handleChange} required />
          <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} required />
          <Field label="Tipo" name="type" value={form.type} onChange={handleChange} placeholder="Plástico, Tinte, Pajilla…" />
          <Field label="Color" name="color" value={form.color} onChange={handleChange} />
          <Field label="Existencia" name="stock" type="number" value={form.stock} onChange={handleChange} required />
          <SelectField label="Unidad" name="unit" value={form.unit} onChange={handleChange} options={UNITS} />
          <Field label="Stock mínimo" name="minStock" type="number" value={form.minStock} onChange={handleChange} />
          <Field label="Costo unitario ($)" name="unitCost" type="number" step="0.01" value={form.unitCost} onChange={handleChange} />
          <Field label="Ubicación" name="location" value={form.location} onChange={handleChange} placeholder="Bodega A-1" />
        </form>
      </Modal>
    </div>
  );
}

export default Inventario;
