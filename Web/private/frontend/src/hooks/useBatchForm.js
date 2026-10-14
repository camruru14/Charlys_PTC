import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "./useFetch";
import { useConfirm } from "./useConfirm";
import { useProductionLines } from "./useProductionLines";
import { formatBatchNumber } from "../lib/format";

export const emptyBatchForm = {
  batchNumber: "",
  product: "", // nombre de un producto del Catálogo (ProductSelect); sin valor por defecto
  color: "Rojo",
  productionLine: "",
  producedQuantity: "",
  targetQuantity: "",
  status: "Programado",
  operator: "",
  startDate: "",
};

// Fecha ya guardada -> "yyyy-mm-dd" (el valor de DateField / DatePicker).
// El backend guarda startDate como medianoche UTC del día elegido (Mongoose castea
// el string "yyyy-mm-dd" así), así que lo leemos de vuelta en UTC para no correrlo
// un día hacia atrás en husos horarios detrás de UTC (p. ej. El Salvador, UTC-6).
function toDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Fecha de creación -> "yyyy-mm-dd" en el calendario LOCAL del usuario (no en UTC: de noche, en El Salvador,
// la fecha UTC ya es la del día siguiente).
function localDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
  // `operatorsLoading`: mientras los empleados cargan no se sabe si hay operarios (Iniciar espera).
  const { data: employees, loading: operatorsLoading } = useFetch("/employees");
  // Un lote nuevo arranca en la primera línea activa de Configuración.
  const { options: lineOptions } = useProductionLines();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBatchForm);
  // El formulario tal como se abrió al editar: al guardar solo se mandan los campos que cambiaron.
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);

  // "Operario responsable" del lote: solo empleados del Área Fabricación.
  const operators = (Array.isArray(employees) ? employees : []).filter(
    (e) => e.department === "Fabricación",
  );

  function openCreate() {
    setEditingId(null);
    setOriginal(null);
    setForm({ ...emptyBatchForm, batchNumber: previewBatchNumber(list), startDate: todayInput(), productionLine: lineOptions[0] || "" });
    setModalOpen(true);
  }

  function openEdit(batch) {
    setEditingId(batch._id);
    const opened = {
      batchNumber: batch.batchNumber || "",
      product: batch.product || "",
      color: batch.color || "",
      productionLine: batch.productionLine || "",
      producedQuantity: batch.producedQuantity ?? "",
      targetQuantity: batch.targetQuantity ?? "",
      status: batch.status || "Programado",
      operator: batch.operator?._id || batch.operator || "",
      // Sin fecha de inicio guardada se muestra la de creación (local), pero no se reenvía si no se toca.
      startDate: batch.startDate ? toDateInput(batch.startDate) : localDateInput(batch.createdAt),
    };
    setOriginal(opened);
    setForm(opened);
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product) {
      toast.error("Elige la categoría y el producto");
      return;
    }
    // Al editar solo se mandan los campos que cambiaron respecto al lote que se abrió: nunca el estado
    // ni lo producido (cambian con las acciones del lote: iniciar, completar…), y así editar el
    // operario de un lote completado no lo regresa a «En proceso» ni borra lo producido.
    let payload;
    if (editingId) {
      payload = {};
      for (const field of ["product", "color", "productionLine", "startDate"]) {
        if (form[field] !== original?.[field]) payload[field] = form[field];
      }
      if (form.targetQuantity !== original?.targetQuantity && form.targetQuantity !== "") payload.targetQuantity = Number(form.targetQuantity);
      // «Sin asignar» manda null para quitar el operario.
      if (form.operator !== original?.operator) payload.operator = form.operator || null;
      if (Object.keys(payload).length === 0) {
        toast("No hay cambios que guardar");
        setModalOpen(false);
        return;
      }
    } else {
      const { batchNumber, ...rest } = form;
      payload = {
        ...rest,
        producedQuantity: Number(form.producedQuantity) || 0,
        // Sin meta no se manda: así no se crea con una meta vacía.
        targetQuantity: form.targetQuantity === "" ? undefined : Number(form.targetQuantity),
        operator: form.operator || undefined,
        startDate: form.startDate || undefined,
      };
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/productionBatches/${editingId}`, payload);
        toast.success("Lote actualizado");
      } else {
        const res = await api.post("/productionBatches", payload);
        toast.success(res?.batchNumber ? `Lote ${formatBatchNumber(res.batchNumber)} creado` : "Lote creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
      // 409 (el lote cambió o ya está ligado a un pedido, empacado o en bodega): se actualiza la lista.
      if (err.status === 409) refetch();
    } finally {
      setSaving(false);
    }
  }

  // Devuelve true si el lote se eliminó.
  async function handleDelete(batch) {
    if (!(await confirm(`¿Eliminar el lote ${formatBatchNumber(batch.batchNumber)}?`, { danger: true }))) return false;
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
    operatorsLoading,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
    confirmProps,
  };
}
