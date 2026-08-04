import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "./useFetch";

export const emptyBatchForm = {
  batchNumber: "",
  product: "Pajilla",
  color: "Rojo",
  productionLine: "Línea 1",
  targetQuantity: "",
  producedQuantity: "",
  wasteQuantity: "",
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
export function useBatchForm(list, refetch) {
  const { data: employees } = useFetch("/employees");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBatchForm);
  const [saving, setSaving] = useState(false);

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
      targetQuantity: batch.targetQuantity ?? "",
      producedQuantity: batch.producedQuantity ?? "",
      wasteQuantity: batch.wasteQuantity ?? "",
      status: batch.status || "Programado",
      operator: batch.operator?._id || batch.operator || "",
      startDate: toDateInput(batch.startDate || batch.createdAt),
    });
    setModalOpen(true);
  }

  // Residuos = Cantidad meta - Cantidad producida (0 si se produjo lo esperado o más).
  // Se recalcula solo, así el % de residuos que guarda el backend sale automático.
  // Mientras no se haya ingresado lo producido, todavía no hay con qué calcularlo.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === "targetQuantity" || name === "producedQuantity") {
        const producedRaw = name === "producedQuantity" ? value : f.producedQuantity;
        if (producedRaw === "") {
          next.wasteQuantity = "";
        } else {
          const target = Number(name === "targetQuantity" ? value : f.targetQuantity) || 0;
          const produced = Number(producedRaw) || 0;
          next.wasteQuantity = target > produced ? String(target - produced) : "0";
        }
      }
      return next;
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { batchNumber, ...rest } = form;
    const payload = {
      ...rest,
      targetQuantity: Number(form.targetQuantity) || 0,
      producedQuantity: Number(form.producedQuantity) || 0,
      wasteQuantity: Number(form.wasteQuantity) || 0,
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
    handleReport,
  };
}
