import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "./useFetch";
import { useConfirm } from "./useConfirm";

export const emptyBatchForm = {
  batchNumber: "",
  product: "Pajilla",
  color: "Rojo",
  productionLine: "Línea 1",
  producedQuantity: "",
  targetQuantity: "",
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
  Estado y acciones (crear/editar/eliminar) para lotes de fabricación.
  Lo usan Fabricación y el «Ver todo» editable de Fabricación. El avance del
  lote (iniciar, completar, enviar a bodega…) vive en LotesFabricacion.
*/
export function useBatchForm(list, refetch) {
  const { confirm, confirmProps } = useConfirm();
  const { data: employees } = useFetch("/employees");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBatchForm);
  const [saving, setSaving] = useState(false);

  // "Operario responsable" del lote: solo empleados del Área Fabricación.
  const operators = (Array.isArray(employees) ? employees : []).filter(
    (e) => e.department === "Fabricación",
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
      targetQuantity: batch.targetQuantity ?? "",
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
      // Sin meta no se manda: así editar no borra una meta que ya tenga.
      targetQuantity: form.targetQuantity === "" ? undefined : Number(form.targetQuantity),
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

  // Devuelve true si el lote se eliminó.
  async function handleDelete(batch) {
    if (!(await confirm(`¿Eliminar el lote ${batch.batchNumber}?`, { danger: true }))) return false;
    try {
      await api.del(`/productionBatches/${batch._id}`);
      toast.success("Lote eliminado");
      refetch();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  return {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    saving,
    operators,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
    confirmProps,
  };
}
