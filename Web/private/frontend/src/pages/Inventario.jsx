import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import KpiInline from "../components/ui/KpiInline";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { Field, SelectField } from "../components/ui/Field";
import ProductoTerminado from "./inventario/ProductoTerminado";
import MateriaPrima from "./inventario/MateriaPrima";
import PedidosInventario from "./inventario/PedidosInventario";
import { IconPlus } from "../lib/icons";
import { buttonClass } from "../lib/buttonStyles";
import { fmtNumber } from "../lib/format";
import { isBelowMinimum } from "../lib/stockLevel";
import { UNITS, MATERIAL_TYPES } from "../lib/inventoryOptions";

// Los lotes de Fabricación entran directo a Producto terminado al enviarse a
// bodega (Fase 5), así que ya no hay pestaña de «Lotes reportados».
const TABS = [
  { key: "terminado", label: "Producto terminado" },
  { key: "materia", label: "Materia prima" },
  { key: "pedidos", label: "Pedidos" },
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

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const orders = useMemo(() => (Array.isArray(ordersData) ? ordersData : []), [ordersData]);

  // Stock real, divididos por categoría. Se excluyen los artículos con
  // batchNumber: son reportes de lote que todavía crea la app Movil, no stock.
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

  const isFinished = form.category === "Producto Terminado";

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Inventario"
        subtitle={
          activeTab === "pedidos"
            ? "Pedidos — llegan solos, se verifican de una vez y se empacan sin confirmación"
            : "Materia prima y stock de productos terminados"
        }
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
      ) : (
        <PedidosInventario
          orders={orders}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          refetchOrders={refetchOrders}
          finishedItems={finishedItems}
          refetchInventory={refetch}
        />
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

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Inventario;
