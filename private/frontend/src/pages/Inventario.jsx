import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconBox, IconAlert, IconPlus, IconCheck } from "../lib/icons";

const CATEGORIES = ["Materia Prima", "Producto Terminado"];
const UNITS = ["kg", "unidad", "caja", "litro"];

const emptyForm = {
  name: "", category: "Materia Prima",
  unit: "kg", stock: "", minStock: "", unitCost: "", location: "",
};

function Inventario() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch("/inventory");
  const [activeTab, setActiveTab] = useState("articulos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);
  const [sending, setSending] = useState(false);

  const list = Array.isArray(data) ? data : [];

  // Artículos generados automáticamente al confirmar "Reportar" en Fabricación
  // (llevan batchNumber). Se quedan en "Lotes Reportados" para siempre, se
  // hayan enviado o no a almacén.
  const reportedItems = useMemo(
    () =>
      list
        .filter((i) => i.batchNumber)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [list]
  );

  // "Artículos en almacén": los agregados a mano, más los lotes reportados que
  // ya se confirmaron con "Enviar" (esos también siguen apareciendo arriba,
  // en Lotes Reportados).
  const warehouseItems = useMemo(
    () => list.filter((i) => !i.batchNumber || i.sentToWarehouse),
    [list]
  );

  const fmtDate = (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
  };

  const kpis = useMemo(() => {
    const raw = warehouseItems.filter((i) => i.category === "Materia Prima").length;
    const finished = warehouseItems.filter((i) => i.category === "Producto Terminado").length;
    const low = warehouseItems.filter((i) => i.minStock > 0 && i.stock <= i.minStock).length;
    const value = warehouseItems.reduce((s, i) => s + (i.stock || 0) * (i.unitCost || 0), 0);
    return { raw, finished, low, value };
  }, [warehouseItems]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "", category: item.category || "Materia Prima",
      unit: item.unit || "kg",
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

  function openSend(item) {
    setSendTarget(item);
    setSendModalOpen(true);
  }

  // Envía un lote reportado a "Artículos en almacén": lo marca como enviado,
  // así pasa a contar también como stock de almacén sin dejar de aparecer
  // (ni borrarse) en Lotes Reportados.
  async function confirmSend() {
    setSending(true);
    try {
      await api.patch(`/inventory/${sendTarget._id}/send`);
      toast.success(`${sendTarget.name} enviado a Artículos en almacén`);
      setSendModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
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

      {/* Selector de tabla: Artículos en almacén / Lotes Reportados */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("articulos")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "articulos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Artículos en almacén
        </button>
        <button
          onClick={() => setActiveTab("lotes")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "lotes" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Lotes Reportados
        </button>
      </div>

      {activeTab === "articulos" ? (
        <SectionCard
          title="Artículos en almacén"
          action={
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <IconPlus width={16} height={16} /> Agregar artículo
            </button>
          }
        >
          <AsyncState loading={loading} error={error} empty={!loading && warehouseItems.length === 0} emptyText="No hay artículos.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Artículo</th>
                    <th className="pb-3 pr-4 font-semibold">Categoría</th>
                    <th className="pb-3 pr-4 font-semibold">Existencia</th>
                    <th className="pb-3 pr-4 font-semibold">Bodega</th>
                    <th className="pb-3 pr-4 font-semibold">Estado</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warehouseItems.map((i) => {
                    const low = i.minStock > 0 && i.stock <= i.minStock;
                    return (
                      <tr key={i._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{i.name}</td>
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
      ) : (
        <SectionCard
          title="Lotes Reportados"
          action={
            <button onClick={() => navigate("/fabricacion")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
              Ir a Fabricación
            </button>
          }
        >
          <AsyncState
            loading={loading}
            error={error}
            empty={!loading && reportedItems.length === 0}
            emptyText="Aún no hay lotes reportados desde Fabricación."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Lote</th>
                    <th className="pb-3 pr-4 font-semibold">Artículo</th>
                    <th className="pb-3 pr-4 font-semibold">Categoría</th>
                    <th className="pb-3 pr-4 font-semibold">Existencia</th>
                    <th className="pb-3 pr-4 font-semibold">Bodega</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha Reportaje</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportedItems.map((i) => (
                    <tr key={i._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{i.batchNumber}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-800">{i.name}</td>
                      <td className="py-3 pr-4">{i.category}</td>
                      <td className="py-3 pr-4 tabular-nums">{(i.stock || 0).toLocaleString("es-SV")} {i.unit}</td>
                      <td className="py-3 pr-4">{i.location || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(i.updatedAt)}</td>
                      <td className="py-3 text-right">
                        {i.sentToWarehouse ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <IconCheck width={14} height={14} /> Enviado
                          </span>
                        ) : (
                          <button onClick={() => openSend(i)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Enviar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </SectionCard>
      )}

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
          <Field label="Artículo" name="name" value={form.name} onChange={handleChange} required />
          <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} required />
          <Field label="Existencia" name="stock" type="number" value={form.stock} onChange={handleChange} required />
          <SelectField label="Unidad" name="unit" value={form.unit} onChange={handleChange} options={UNITS} />
          <Field label="Stock mínimo" name="minStock" type="number" value={form.minStock} onChange={handleChange} />
          <Field label="Costo unitario ($)" name="unitCost" type="number" step="0.01" value={form.unitCost} onChange={handleChange} />
          <Field label="Bodega" name="location" value={form.location} onChange={handleChange} placeholder="Bodega A-1" />
        </form>
      </Modal>

      <Modal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Enviar a Artículos en almacén"
        footer={
          <>
            <button onClick={() => setSendModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmSend} disabled={sending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {sending ? "Enviando…" : "Confirmar envío"}
            </button>
          </>
        }
      >
        {sendTarget ? (
          <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
            Vas a enviar <strong>{sendTarget.name}</strong> (lote {sendTarget.batchNumber}) a Artículos en almacén.
            Sus {(sendTarget.stock || 0).toLocaleString("es-SV")} {sendTarget.unit} pasarán a contar como stock de almacén,
            sin dejar de aparecer aquí en Lotes Reportados.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

export default Inventario;
