import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Field, ReadonlyField, SelectField } from "../ui/Field";
import DateField from "../ui/DateField";
import { IconLink, IconPaperclip } from "../../lib/icons";
import { blockNegativeKey } from "../../lib/numberInput";
import { buttonClass } from "../../lib/buttonStyles";
import { invoiceError, PAYMENT_METHODS } from "../../lib/finance";
import { endOfMonthInput, inDays } from "../../lib/calendar";
import { todayInput } from "../../hooks/useBatchForm";

/*
  Editar un movimiento manual de Finanzas: los mismos campos del registro
  rápido, más el N° de transacción (solo lectura), la factura (ver, reemplazar,
  quitar) y «Marcar pagado» si está pendiente. La factura se sube o se quita en
  el momento; el resto se guarda con «Guardar». Las ventas de la tienda no se
  editan (no llegan aquí).
*/

// Atajos de «Fecha» (el movimiento no puede ser futuro).
const dateShortcuts = () => [
  { label: "Hoy", value: todayInput() },
  { label: "Ayer", value: inDays(-1) },
];

const dateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

function TransactionModal({ transaction: t, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    concept: t.concept || "",
    type: t.type || "Gasto",
    category: t.category || "",
    amount: t.amount ?? "",
    status: t.status || "Completado",
    paymentMethod: t.paymentMethod || "",
    date: dateInput(t.date),
    dueDate: dateInput(t.dueDate),
  });
  const [attachment, setAttachment] = useState(t.attachment || null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const isExpense = form.type === "Gasto";
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Categorías que se pueden elegir: las activas, y la que ya tiene el gasto aunque esté archivada.
  const categoryOptions = categories
    .filter((c) => !c.archived || c.name === t.category)
    .map((c) => ({ value: c.name, label: c.archived ? `${c.name} (archivada)` : c.name }));
  if (t.category && t.type === "Gasto" && !categoryOptions.some((o) => o.value === t.category)) categoryOptions.push({ value: t.category, label: t.category });

  // Al cambiar el tipo, la categoría de un Ingreso («Otros ingresos») no vale para un Gasto: se
  // limpia (queda la que ya tenía si es una categoría elegible de Gasto) y hay que elegirla.
  function changeType(e) {
    const type = e.target.value;
    setForm((f) => ({ ...f, type, category: type === "Gasto" && categoryOptions.some((o) => o.value === f.category) ? f.category : "" }));
  }

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.concept.trim()) return toast.error("Escribe el concepto");
    if (!(amount >= 0) || form.amount === "") return toast.error("Escribe el monto");
    if (isExpense && !form.category) return toast.error("Elige la categoría del gasto");
    if (isExpense && !categoryOptions.some((o) => o.value === form.category)) return toast.error("Elige una categoría válida para el gasto");
    setBusy(true);
    try {
      await api.put(`/transactions/${t._id}`, {
        concept: form.concept.trim(),
        type: form.type,
        amount,
        status: form.status,
        date: form.date || undefined,
        paymentMethod: form.paymentMethod || null,
        ...(isExpense ? { category: form.category } : {}),
        dueDate: form.status === "Pendiente" && form.dueDate ? form.dueDate : null,
      });
      toast.success("Movimiento actualizado");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    setBusy(true);
    try {
      await api.patch(`/transactions/${t._id}/pay`);
      toast.success(`${t.reference} marcado como pagado`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const error = invoiceError(picked);
    if (error) return toast.error(error);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", picked);
      const saved = await api.post(`/transactions/${t._id}/attachment`, body);
      setAttachment(saved.attachment || null);
      toast.success("Factura guardada");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    setUploading(true);
    try {
      await api.del(`/transactions/${t._id}/attachment`);
      setAttachment(null);
      toast.success("Factura quitada");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar movimiento"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          {t.status === "Pendiente" ? (
            <Button variant="soft" size="modal" onClick={markPaid} disabled={busy}>
              Marcar pagado
            </Button>
          ) : null}
          <button type="submit" form="movement-form" disabled={busy} className={buttonClass("primary", "modal")}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form id="movement-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ReadonlyField label="N° de transacción" value={t.reference} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Concepto" name="concept" value={form.concept} onChange={change} required />
        </div>
        <SelectField
          label="Tipo"
          name="type"
          value={form.type}
          onChange={changeType}
          options={[
            { value: "Gasto", label: "Gasto" },
            { value: "Ingreso", label: "Otro ingreso" },
          ]}
        />
        {isExpense ? (
          <SelectField label="Categoría" name="category" value={form.category} onChange={change} options={categoryOptions} placeholder="Elige la categoría" required />
        ) : (
          <ReadonlyField label="Categoría" value="Otros ingresos" />
        )}
        <Field label="Monto ($)" name="amount" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.amount} onChange={change} required />
        <SelectField
          label="Método de pago"
          name="paymentMethod"
          value={form.paymentMethod}
          onChange={change}
          options={PAYMENT_METHODS}
          placeholder="Sin método"
        />
        <SelectField
          label="Estado"
          name="status"
          value={form.status}
          onChange={change}
          options={[
            { value: "Completado", label: "Pagado" },
            { value: "Pendiente", label: isExpense ? "Por pagar" : "Por cobrar" },
          ]}
        />
        {form.status === "Pendiente" ? (
          <DateField
            label="Vence"
            name="dueDate"
            value={form.dueDate}
            onChange={change}
            min={todayInput()}
            shortcuts={[
              { label: "En 7 días", value: inDays(7) },
              { label: "En 15 días", value: inDays(15) },
              { label: "Fin de mes", value: endOfMonthInput() },
            ]}
          />
        ) : (
          <DateField label="Fecha" name="date" value={form.date} onChange={change} max={todayInput()} shortcuts={dateShortcuts()} />
        )}
        {form.status === "Pendiente" ? (
          <DateField label="Fecha del movimiento" name="date" value={form.date} onChange={change} max={todayInput()} shortcuts={dateShortcuts()} />
        ) : null}

        <div className="rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3 sm:col-span-2">
          <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Factura</p>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickFile} />
          {attachment ? (
            <div className="flex flex-wrap items-center gap-2">
              <IconPaperclip width={15} height={15} className="shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={attachment.name}>
                {attachment.name || "Factura"}
              </span>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-soft-text transition hover:text-primary"
              >
                Ver
                <IconLink width={13} height={13} />
              </a>
              <Button type="button" variant="secondary" size="row" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Subiendo…" : "Reemplazar"}
              </Button>
              <Button type="button" variant="secondary" size="row" disabled={uploading} onClick={removeFile} className="!text-tone-rose-text">
                Quitar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="t-aux">Sin factura adjunta (imagen o PDF, hasta 10 MB).</span>
              <Button type="button" variant="secondary" size="row" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Subiendo…" : "Adjuntar"}
              </Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default TransactionModal;
