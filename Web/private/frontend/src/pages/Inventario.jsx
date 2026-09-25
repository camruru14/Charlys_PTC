import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import KpiInline from "../components/ui/KpiInline";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import ProductoTerminado from "./inventario/ProductoTerminado";
import MateriaPrima from "./inventario/MateriaPrima";
import PedidosInventario from "./inventario/PedidosInventario";
import { IconPlus } from "../lib/icons";
import { buttonClass } from "../lib/buttonStyles";
import { fmtNumber, fmtDateYear } from "../lib/format";
import { isBelowMinimum } from "../lib/stockLevel";
import { UNITS, MATERIAL_TYPES } from "../lib/inventoryOptions";

// «Lotes reportados» se queda temporalmente al final hasta que Fabricación
// envíe los lotes directo a bodega (Fase 5).
const TABS = [
  { key: "terminado", label: "Producto terminado" },
  { key: "materia", label: "Materia prima" },
  { key: "pedidos", label: "Pedidos" },
  { key: "lotes", label: "Lotes reportados" },
];

const emptyForm = {
  name: "",
  category: "Producto Terminado",
  type: "",
  unit: "unidad",
  stock: "",
  unitCost: "",
  location: "",
  materialType: MATERIAL_TYPES[0],
};

function Inventario() {
  const navigate = useNavigate();
  const { confirm, confirmProps } = useConfirm();
  const { data, loading, error, refetch } = useFetch("/inventory");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch("/orders");
  // Bodegas configurables desde Configuración > Bodegas.
  const { data: warehousesData } = useFetch("/warehouses");
  const warehouses = (Array.isArray(warehousesData) ? warehousesData : []).map((w) => w.name);
  const [activeTab, setActiveTab] = useUrlState("tab", "terminado", { allowed: TABS.map((t) => t.key) });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);
  const [sending, setSending] = useState(false);
  const [deleteReportModalOpen, setDeleteReportModalOpen] = useState(false);
  const [deleteReportTarget, setDeleteReportTarget] = useState(null);
  const [deletingReport, setDeletingReport] = useState(false);

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const orders = useMemo(() => (Array.isArray(ordersData) ? ordersData : []), [ordersData]);

  // Artículos generados al confirmar "Reportar" en Fabricación (llevan
  // batchNumber). Se quedan en "Lotes reportados", se hayan enviado o no.
  const reportedItems = useMemo(
    () => list.filter((i) => i.batchNumber).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [list]
  );

  // Artículos en almacén (sin batchNumber), divididos por categoría.
  const rawMaterialItems = useMemo(
    () => list.filter((i) => !i.batchNumber && i.category === "Materia Prima"),
    [list]
  );
  const finishedItems = useMemo(
    () => list.filter((i) => !i.batchNumber && i.category === "Producto Terminado"),
    [list]
  );

  // Indicadores en línea de la pestaña activa.
  const kpiItems = useMemo(() => {
    if (activeTab === "terminado") {
      return [
        { label: "Artículos", value: fmtNumber(finishedItems.length), tone: "blue" },
        { label: "Unidades", value: fmtNumber(finishedItems.reduce((s, i) => s + (Number(i.stock) || 0), 0)), tone: "green" },
        { label: "Bajo mínimo", value: fmtNumber(finishedItems.filter(isBelowMinimum).length), tone: "rose" },
      ];
    }
    if (activeTab === "materia") {
      return [
        { label: "Artículos", value: fmtNumber(rawMaterialItems.length), tone: "blue" },
        { label: "Bajo mínimo", value: fmtNumber(rawMaterialItems.filter(isBelowMinimum).length), tone: "rose" },
      ];
    }
    return [];
  }, [activeTab, finishedItems, rawMaterialItems]);

  // «Nuevo artículo» crea en la categoría de la pestaña activa: Materia
  // prima en su pestaña, Producto terminado en las demás.
  function openCreate() {
    const category = activeTab === "materia" ? "Materia Prima" : "Producto Terminado";
    setEditingId(null);
    setForm({ ...emptyForm, category, unit: category === "Materia Prima" ? "kg" : "unidad", location: warehouses[0] || "" });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      category: item.category || "Materia Prima",
      type: item.type || "",
      unit: item.unit || "kg",
      stock: item.stock ?? "",
      unitCost: item.unitCost ?? "",
      location: item.location || warehouses[0] || "",
      materialType: item.materialType || MATERIAL_TYPES[0],
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Costo unitario y Tipo (texto libre) solo aplican a Producto Terminado;
  // el tipo de material solo a Materia Prima. Lo que no aplica no se envía,
  // así no se pisa un valor que ya tuviera.
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      category: form.category,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      location: form.location,
    };
    if (form.category === "Producto Terminado") {
      payload.unitCost = Number(form.unitCost) || 0;
      payload.type = form.type.trim();
    } else {
      payload.materialType = form.materialType;
    }
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
    if (!(await confirm(`¿Eliminar ${item.name}${item.color ? ` · ${item.color}` : ""}?`, { danger: true }))) return;
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

  // Envía un lote reportado a almacén: si ya existe un producto terminado con
  // el mismo artículo, color y bodega, solo se le suman las unidades
  // reportadas; si no, se crea uno nuevo.
  async function confirmSend() {
    setSending(true);
    try {
      await api.patch(`/inventory/${sendTarget._id}/send`);
      toast.success(`${sendTarget.name} enviado a almacén`);
      setSendModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  function openDeleteReport(item) {
    setDeleteReportTarget(item);
    setDeleteReportModalOpen(true);
  }

  // Elimina un lote reportado: el lote en Fabricación queda igual, solo deja
  // de estar "reportado". Si ya se había enviado a almacén, ese stock se
  // conserva sin cambios.
  async function confirmDeleteReport() {
    setDeletingReport(true);
    try {
      await api.del(`/inventory/${deleteReportTarget._id}/report`);
      toast.success(`Reporte de ${deleteReportTarget.batchNumber} eliminado`);
      setDeleteReportModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingReport(false);
    }
  }

  const isFinished = form.category === "Producto Terminado";

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Inventario"
        subtitle="Materia prima y stock de productos terminados"
        actions={
          <Button icon={IconPlus} onClick={openCreate}>
            Nuevo artículo
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {kpiItems.length ? <KpiInline items={kpiItems} /> : <span />}
        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "terminado" ? (
        <ProductoTerminado items={finishedItems} loading={loading} error={error} onEdit={openEdit} onDelete={handleDelete} />
      ) : activeTab === "materia" ? (
        <MateriaPrima items={rawMaterialItems} loading={loading} error={error} onEdit={openEdit} onDelete={handleDelete} />
      ) : activeTab === "pedidos" ? (
        <PedidosInventario
          orders={orders}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          refetchOrders={refetchOrders}
          finishedItems={finishedItems}
          refetchInventory={refetch}
        />
      ) : (
        <SectionCard
          title="Lotes reportados"
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Lote</th>
                    <th className="pb-3 pr-4 font-semibold">Artículo</th>
                    <th className="pb-3 pr-4 font-semibold">Color</th>
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
                      <td className="py-3 pr-4">{i.color || "—"}</td>
                      <td className="py-3 pr-4">{i.category}</td>
                      <td className="py-3 pr-4 tabular-nums">{fmtNumber(i.stock)} {i.unit}</td>
                      <td className="py-3 pr-4">{i.location || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDateYear(i.updatedAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          {i.sentToWarehouse ? (
                            <StatusPill status="En bodega" domain="lote" />
                          ) : (
                            <button onClick={() => openSend(i)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Enviar</button>
                          )}
                          <button onClick={() => openDeleteReport(i)} className="rounded-lg bg-tone-rose px-2.5 py-1 text-tone-rose-text hover:brightness-95">Eliminar</button>
                        </div>
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
        title={(editingId ? "Editar " : "Nuevo ") + (isFinished ? "producto terminado" : "artículo de materia prima")}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="inv-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="inv-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Artículo" name="name" value={form.name} onChange={handleChange} required />
          {isFinished ? (
            <Field label="Tipo" name="type" value={form.type} onChange={handleChange} placeholder="Ej. Normal, Jumbo, 60 mm" />
          ) : (
            <SelectField label="Tipo" name="materialType" value={form.materialType} onChange={handleChange} options={MATERIAL_TYPES} required />
          )}
          <Field label="Existencia" name="stock" type="number" value={form.stock} onChange={handleChange} required />
          <SelectField label="Unidad" name="unit" value={form.unit} onChange={handleChange} options={UNITS} />
          <SelectField label="Bodega" name="location" value={form.location} onChange={handleChange} options={warehouses} required />
          {isFinished ? (
            <Field label="Costo unitario ($)" name="unitCost" type="number" step="0.01" value={form.unitCost} onChange={handleChange} />
          ) : null}
        </form>
      </Modal>

      <Modal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Enviar a almacén"
        footer={
          <>
            <button onClick={() => setSendModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button onClick={confirmSend} disabled={sending} className={buttonClass("primary", "modal")}>
              {sending ? "Enviando…" : "Confirmar envío"}
            </button>
          </>
        }
      >
        {sendTarget ? (
          <p className="rounded-[11px] bg-primary-soft px-3.5 py-2.5 text-[13px] text-primary-soft-text">
            Vas a enviar <strong>{sendTarget.name}</strong> (lote {sendTarget.batchNumber}) a almacén.
            Si ya existe un producto terminado con el mismo artículo, color y bodega, sus {fmtNumber(sendTarget.stock)} {sendTarget.unit}{" "}
            se sumarán a la existencia de ese producto; si no existe, se creará uno nuevo. Aquí en Lotes reportados no cambia nada.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={deleteReportModalOpen}
        onClose={() => setDeleteReportModalOpen(false)}
        title="Eliminar lote reportado"
        footer={
          <>
            <button onClick={() => setDeleteReportModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button onClick={confirmDeleteReport} disabled={deletingReport} className={buttonClass("danger", "modal")}>
              {deletingReport ? "Eliminando…" : "Eliminar"}
            </button>
          </>
        }
      >
        {deleteReportTarget ? (
          <p className="rounded-[11px] bg-tone-rose px-3.5 py-2.5 text-[13px] text-tone-rose-text">
            Vas a eliminar el reporte de <strong>{deleteReportTarget.name}</strong> (lote {deleteReportTarget.batchNumber}).
            El lote en Fabricación queda igual (su producción y estado no cambian), solo deja de estar reportado.
            {deleteReportTarget.sentToWarehouse
              ? " Como ya se había enviado a almacén, ese stock se conserva sin cambios."
              : " Como todavía no se había enviado a almacén, no queda ningún stock que conservar."}
          </p>
        ) : null}
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Inventario;
