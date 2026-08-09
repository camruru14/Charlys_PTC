import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "./useFetch";

export const emptyBatchForm = {
  batchNumber: "",
  product: "Pajilla",
  color: "Rojo",
  productionLine: "Línea 1",
  producedQuantity: "",
  status: "Programado",
  operator: "",
  startDate: "",
};

// Fecha ya guardada -> "yyyy-mm-dd" para el <input type="date">.
// El backend guarda startDate como medianoche UTC del día elegido (Mongoose castea
// el string "yyyy-mm-dd" así), así que lo leemos de vuelta en UTC para no correrlo
// un día hacia atrás en husos horarios detrás de UTC (p. ej. El Salvador, UTC-6).
function toDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// "Hoy" -> "yyyy-mm-dd" en el calendario LOCAL del usuario (para el valor por
// defecto al crear y como tope máximo del campo Fecha). A diferencia de
// toDateInput, aquí sí importa el huso local.
export function todayInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// Vista previa del próximo número de lote (el backend genera el definitivo al guardar)
export function previewBatchNumber(list) {
  const prefix = `LOTE-${new Date().getFullYear()}-`;
  const lastNumber = list.reduce((max, b) => {
    if (!b.batchNumber?.startsWith(prefix)) return max;
    const n = parseInt(b.batchNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

/*
  Estado y acciones (crear/editar/eliminar/reportar) para lotes de fabricación.
  Reutilizado por la página de Fabricación y por el "Ver todo" editable de Fabricación.
*/
const emptyReportForm = { producedQuantity: "", warehouse: "" };

export function useBatchForm(list, refetch) {
  const { data: employees } = useFetch("/employees");
  // Bodegas disponibles para reportar producción a Inventario (Parte 8:
  // configurables desde Configuración > Bodegas, ya no un arreglo fijo).
  const { data: warehousesData } = useFetch("/warehouses");
  const warehouses = (Array.isArray(warehousesData) ? warehousesData : []).map((w) => w.name);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBatchForm);
  const [saving, setSaving] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [reporting, setReporting] = useState(false);

  const [undoReportModalOpen, setUndoReportModalOpen] = useState(false);
  const [undoReportTarget, setUndoReportTarget] = useState(null);
  const [undoingReport, setUndoingReport] = useState(false);

  const operators = (Array.isArray(employees) ? employees : []).filter((e) =>
    ["operario", "gerente", "admin"].includes(e.role),
  );

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyBatchForm, batchNumber: previewBatchNumber(list), startDate: todayInput() });
    setModalOpen(true);
  }

  function openEdit(batch) {
    setEditingId(batch._id);
    setForm({
      batchNumber: batch.batchNumber || "",
      product: batch.product || "Pajilla",
      color: batch.color || "",
      productionLine: batch.productionLine || "Línea 1",
      producedQuantity: batch.producedQuantity ?? "",
      status: batch.status || "Programado",
      operator: batch.operator?._id || batch.operator || "",
      startDate: toDateInput(batch.startDate || batch.createdAt),
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { batchNumber, ...rest } = form;
    const payload = {
      ...rest,
      producedQuantity: Number(form.producedQuantity) || 0,
      operator: form.operator || undefined,
      startDate: form.startDate || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/productionBatches/${editingId}`, payload);
        toast.success("Lote actualizado");
      } else {
        const res = await api.post("/productionBatches", payload);
        toast.success(res?.batchNumber ? `Lote ${res.batchNumber} creado` : "Lote creado");
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

  // Abre el modal de confirmación de "Reportar" (reemplaza los antiguos window.prompt).
  // Las unidades a reportar se toman solas de lo que ya está guardado como
  // producción del lote (columna "Producido"), sin pedirlo a mano ni
  // recalcularlo aparte, así se reporta siempre la misma cantidad.
  function openReport(batch) {
    setReportTarget(batch);
    setReportForm({ producedQuantity: String(batch.producedQuantity || 0), warehouse: warehouses[0] || "" });
    setReportModalOpen(true);
  }

  const handleReportChange = (e) => setReportForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Confirma el reporte: envía la misma cantidad producida ya guardada en el
  // lote y, del lado del backend, agrega/actualiza el artículo
  // correspondiente en Inventario con ese mismo número.
  async function submitReport(e) {
    e.preventDefault();
    setReporting(true);
    try {
      await api.patch(`/productionBatches/${reportTarget._id}/report`, {
        producedQuantity: Number(reportForm.producedQuantity) || 0,
        warehouse: reportForm.warehouse,
      });
      toast.success(`Lote ${reportTarget.batchNumber} reportado a Inventario`);
      setReportModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReporting(false);
    }
  }

  // Abre el modal de confirmación para deshacer el reporte de un lote
  // (clic en la etiqueta "Reportado").
  function openUndoReport(batch) {
    setUndoReportTarget(batch);
    setUndoReportModalOpen(true);
  }

  // Confirma deshacer el reporte: el lote vuelve a "no reportado" y, del lado
  // del backend, se resuelve el artículo vinculado en Inventario (se borra si
  // nunca se envió a almacén, o se desvincula conservando el stock si ya se
  // había enviado).
  async function confirmUndoReport() {
    setUndoingReport(true);
    try {
      await api.del(`/productionBatches/${undoReportTarget._id}/report`);
      toast.success(`Reporte de ${undoReportTarget.batchNumber} deshecho`);
      setUndoReportModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUndoingReport(false);
    }
  }

  return {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    saving,
    operators,
    warehouses,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
    reportModalOpen,
    setReportModalOpen,
    reportTarget,
    reportForm,
    reporting,
    openReport,
    handleReportChange,
    submitReport,
    undoReportModalOpen,
    setUndoReportModalOpen,
    undoReportTarget,
    undoingReport,
    openUndoReport,
    confirmUndoReport,
  };
}
