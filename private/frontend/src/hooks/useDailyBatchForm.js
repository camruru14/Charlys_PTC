import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { todayInput } from "./useBatchForm";
import { useConfirm } from "./useConfirm";

export const emptyDailyBatchForm = {
  dailyBatchNumber: "",
  date: "",
  product: "Pajilla",
  color: "Rojo",
};

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
      product: batch.product || "Pajilla",
      color: batch.color || "",
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { dailyBatchNumber, ...rest } = form;
    const payload = {
      ...rest,
      date: form.date || undefined,
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
      toast.error(err.message);
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

  async function handleSchedule(batch) {
    if (!(await confirm(`¿Programar el lote ${batch.dailyBatchNumber}? Se enviará a Lotes de fabricación.`, { confirmLabel: "Programar" }))) return;
    try {
      const res = await api.patch(`/dailyBatches/${batch._id}/schedule`);
      toast.success(res?.batchNumber ? `Lote ${res.batchNumber} programado` : "Lote programado");
      refetch();
      onScheduled?.();
    } catch (err) {
      toast.error(err.message);
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
