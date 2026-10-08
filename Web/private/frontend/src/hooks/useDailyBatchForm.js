import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { todayInput } from "./useBatchForm";
import { useConfirm } from "./useConfirm";
import { formatBatchNumber } from "../lib/format";

export const emptyDailyBatchForm = {
  dailyBatchNumber: "",
  date: "",
  product: "", // nombre de un producto del Catálogo (ProductSelect); sin valor por defecto
  color: "Rojo",
  targetQuantity: "", // Meta (unidades): entero de 1 a 9 999 999, obligatoria
};

const MAX_TARGET = 9999999;

// Mismos mensajes que el backend (dailyBatchesController). Devuelve el mensaje
// del error, o null si la meta es válida.
export function targetError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Escribe la meta del lote (unidades).";
  const n = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(n) || n < 1 || n > MAX_TARGET) return "La meta debe ser un número entero entre 1 y 9 999 999.";
  return null;
}

// Vista previa del próximo ID de lote diario (el backend genera el definitivo al guardar)
export function previewDailyBatchNumber(list) {
  const prefix = "LTE-DIARIO-";
  const lastNumber = list.reduce((max, b) => {
    if (!b.dailyBatchNumber?.startsWith(prefix)) return max;
    const n = parseInt(b.dailyBatchNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

/*
  Estado y acciones (crear/editar/eliminar/programar) para lotes diarios.
  "Programar" envía el lote a Lotes de fabricación (Línea, Producido y
  Operario quedan vacíos ahí, editables después) y lo quita de esta lista.
*/
export function useDailyBatchForm(list, refetch, onScheduled) {
  const { confirm, confirmProps } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyDailyBatchForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyDailyBatchForm, dailyBatchNumber: previewDailyBatchNumber(list), date: todayInput() });
    setModalOpen(true);
  }

  function openEdit(batch) {
    setEditingId(batch._id);
    setForm({
      dailyBatchNumber: batch.dailyBatchNumber || "",
      date: batch.date ? new Date(batch.date).toISOString().slice(0, 10) : "",
      product: batch.product || "",
      color: batch.color || "",
      targetQuantity: batch.targetQuantity != null ? String(batch.targetQuantity) : "",
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product) {
      toast.error("Elige la categoría y el producto");
      return;
    }
    const invalidTarget = targetError(form.targetQuantity);
    if (invalidTarget) {
      toast.error(invalidTarget);
      return;
    }
    setSaving(true);
    const { dailyBatchNumber, ...rest } = form;
    const payload = {
      ...rest,
      date: form.date || undefined,
      targetQuantity: Number(form.targetQuantity),
    };
    try {
      if (editingId) {
        await api.put(`/dailyBatches/${editingId}`, payload);
        toast.success("Lote diario actualizado");
      } else {
        const res = await api.post("/dailyBatches", payload);
        toast.success(res?.dailyBatchNumber ? `Lote ${res.dailyBatchNumber} creado` : "Lote diario creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(batch) {
    if (!(await confirm(`¿Eliminar el lote ${batch.dailyBatchNumber}?`, { danger: true }))) return;
    try {
      await api.del(`/dailyBatches/${batch._id}`);
      toast.success("Lote diario eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Programar es directo (no destruye nada): el lote pasa a Lotes de fabricación.
  async function handleSchedule(batch) {
    try {
      const res = await api.patch(`/dailyBatches/${batch._id}/schedule`);
      toast.success(res?.batchNumber ? `Lote ${formatBatchNumber(res.batchNumber)} programado` : "Lote programado");
      refetch();
      onScheduled?.();
    } catch (err) {
      // El backend explica por qué no se pudo (p. ej. el lote no tiene meta).
      toast.error(err.message, { duration: 6000 });
    }
  }

  return {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    saving,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
    handleSchedule,
    confirmProps,
  };
}
