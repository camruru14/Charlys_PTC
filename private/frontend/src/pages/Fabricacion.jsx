import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconFactory, IconAlert, IconCheck, IconPlus } from "../lib/icons";

const PRODUCTS = ["Pajilla", "Pelota"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];
const LINES = ["Línea 1", "Línea 2", "Línea 3", "Línea 4"];
const STATUSES = ["Programado", "En Proceso", "Completado", "Detenido"];

const emptyForm = {
  batchNumber: "",
  product: "Pajilla",
  color: "Rojo",
  productionLine: "Línea 1",
  targetQuantity: "",
  producedQuantity: "",
  wasteQuantity: "",
  status: "Programado",
  operator: "",
};

function newBatchNumber() {
  return "LOTE-" + String(Date.now()).slice(-6);
}

function Fabricacion() {
  const { data: batches, loading, error, refetch } = useFetch("/productionBatches");
  const { data: employees } = useFetch("/employees");
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(batches) ? batches : [];
  const operators = (Array.isArray(employees) ? employees : []).filter((e) =>
    ["operario", "gerente", "admin"].includes(e.role),
  );

  // Abrir el modal automáticamente si venimos de "+ Nuevo Lote" del Sidebar
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const kpis = useMemo(() => {
    const produced = list.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    const inProcess = list.filter((b) => b.status === "En Proceso").length;
    const stopped = list.filter((b) => b.status === "Detenido").length;
    const waste = list.reduce((s, b) => s + (b.wastePercentage || 0), 0);
    const avgWaste = list.length ? (waste / list.length).toFixed(1) : "0.0";
    return { produced, inProcess, stopped, avgWaste };
  }, [list]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, batchNumber: newBatchNumber() });
    setModalOpen(true);
  }

  function openEdit(batch) {
    setEditingId(batch._id);
    setForm({
      batchNumber: batch.batchNumber || "",
      product: batch.product || "Pajilla",
      color: batch.color || "",
      productionLine: batch.productionLine || "Línea 1",
      targetQuantity: batch.targetQuantity ?? "",
      producedQuantity: batch.producedQuantity ?? "",
      wasteQuantity: batch.wasteQuantity ?? "",
      status: batch.status || "Programado",
      operator: batch.operator?._id || batch.operator || "",
    });
    setModalOpen(true);
  }

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      targetQuantity: Number(form.targetQuantity) || 0,
      producedQuantity: Number(form.producedQuantity) || 0,
      wasteQuantity: Number(form.wasteQuantity) || 0,
      operator: form.operator || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/productionBatches/${editingId}`, payload);
        toast.success("Lote actualizado");
      } else {
        await api.post("/productionBatches", payload);
        toast.success("Lote creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(batch) {
    if (!window.confirm(`¿Eliminar el lote ${batch.batchNumber}?`)) return;
    try {
      await api.del(`/productionBatches/${batch._id}`);
      toast.success("Lote eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleReport(batch) {
    const produced = window.prompt(`Producción a reportar para ${batch.batchNumber} (unidades):`, "0");
    if (produced === null) return;
    const waste = window.prompt("Residuos generados (unidades):", "0");
    if (waste === null) return;
    try {
      await api.patch(`/productionBatches/${batch._id}/report`, {
        producedQuantity: Number(produced) || 0,
        wasteQuantity: Number(waste) || 0,
      });
      toast.success("Producción reportada");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Producción total" value={kpis.produced.toLocaleString("es-SV")} icon={IconFactory} trend={{ tone: "blue", label: `${list.length} lotes` }} />
        <KpiCard label="Lotes en proceso" value={kpis.inProcess} icon={IconCheck} trend={{ tone: "blue", label: "activos" }} />
        <KpiCard label="Índice de residuos (prom.)" value={`${kpis.avgWaste}%`} icon={IconAlert} trend={{ tone: kpis.avgWaste > 2.5 ? "yellow" : "green", label: kpis.avgWaste > 2.5 ? "Revisar" : "Estable" }} />
        <KpiCard label="Lotes detenidos" value={kpis.stopped} icon={IconAlert} trend={{ tone: kpis.stopped ? "red" : "green", label: kpis.stopped ? "Alerta" : "OK" }} />
      </div>

      <SectionCard
        title="Lotes de fabricación"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Nuevo Lote
          </button>
        }
      >
        <AsyncState loading={loading} error={error} empty={!loading && list.length === 0} emptyText="Aún no hay lotes registrados.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Lote</th>
                  <th className="pb-3 pr-4 font-semibold">Producto</th>
                  <th className="pb-3 pr-4 font-semibold">Línea</th>
                  <th className="pb-3 pr-4 font-semibold">Meta</th>
                  <th className="pb-3 pr-4 font-semibold">Producido</th>
                  <th className="pb-3 pr-4 font-semibold">Residuos</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((b) => (
                  <tr key={b._id} className="text-slate-600 transition hover:bg-slate-50/60">
                    <td className="py-3 pr-4 font-semibold text-slate-800">{b.batchNumber}</td>
                    <td className="py-3 pr-4">{b.product}{b.color ? ` · ${b.color}` : ""}</td>
                    <td className="py-3 pr-4">{b.productionLine || "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">{(b.targetQuantity || 0).toLocaleString("es-SV")}</td>
                    <td className="py-3 pr-4 tabular-nums">{(b.producedQuantity || 0).toLocaleString("es-SV")}</td>
                    <td className="py-3 pr-4 tabular-nums">{b.wastePercentage ?? 0}%</td>
                    <td className="py-3 pr-4"><StatusPill status={b.status} /></td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button onClick={() => handleReport(b)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Reportar</button>
                        <button onClick={() => openEdit(b)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                        <button onClick={() => handleDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
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
        title={editingId ? "Editar lote" : "Nuevo lote de fabricación"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="batch-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="batch-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Número de lote" name="batchNumber" value={form.batchNumber} onChange={handleChange} required />
          <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
          <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
          <SelectField label="Línea de producción" name="productionLine" value={form.productionLine} onChange={handleChange} options={LINES} />
          <Field label="Cantidad meta" name="targetQuantity" type="number" value={form.targetQuantity} onChange={handleChange} required />
          <Field label="Cantidad producida" name="producedQuantity" type="number" value={form.producedQuantity} onChange={handleChange} />
          <Field label="Residuos" name="wasteQuantity" type="number" value={form.wasteQuantity} onChange={handleChange} />
          <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
          <SelectField
            label="Operario responsable"
            name="operator"
            value={form.operator}
            onChange={handleChange}
            placeholder="Sin asignar"
            options={operators.map((o) => ({ value: o._id, label: `${o.name} ${o.lastName}` }))}
          />
        </form>
      </Modal>
    </div>
  );
}

export default Fabricacion;
