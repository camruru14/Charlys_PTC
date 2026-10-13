import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Button from "../ui/Button";
import { useDropdown } from "../../hooks/useDropdown";
import CategoryCombobox from "./CategoryCombobox";
import { IconCalendar, IconCheck, IconChevronDown, IconClose, IconPaperclip } from "../../lib/icons";
import { categoryTone } from "../../lib/expenseCategories";
import { blockNegativeKey } from "../../lib/numberInput";
import { invoiceError, PAYMENT_METHODS } from "../../lib/finance";
import { fmtDate } from "../../lib/format";
import { todayInput } from "../../hooks/useBatchForm";

/*
  Registro rápido de Finanzas: una tarjeta de UNA sola línea (~60 px) para anotar un gasto (o un
  ingreso que no es venta de la tienda) sin abrir un formulario. De izquierda a derecha:
    tipo (− Gasto / + Ingreso) · monto · concepto (flex-1) · categoría (combobox con buscador; con
    un ingreso, el bloque fijo «Otros ingresos») · método y estado en un solo selector (con el
    vencimiento si está por pagar) · factura (clip) · fecha («Hoy») · Guardar
  Todos los controles miden 38 px. Desde 1280 px cabe siempre en una línea; más angosto la fila
  envuelve y el concepto ocupa una línea completa.
  Enter en cualquier campo guarda. Tras guardar se limpian monto, concepto, factura, fecha y
  vencimiento (el estado vuelve a «Pagado»); se conservan tipo, categoría y método, y el foco vuelve
  al monto. La última categoría usada se recuerda en localStorage (finanzas.lastCategory), sale
  primera en el combobox y queda preseleccionada.
*/

const LAST_CATEGORY_KEY = "finanzas.lastCategory";

const fieldClass =
  "h-[38px] rounded-[10px] border bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";
const iconButtonClass = "inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border text-[12.5px] font-semibold transition";

function readLastCategory() {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY) || "";
  } catch {
    return "";
  }
}

function writeLastCategory(name) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, name);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): simplemente no se recuerda.
  }
}

const dateOf = (value) => new Date(`${value}T00:00:00`);

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex h-9 rounded-[10px] border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-semibold transition ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.dot ? <span className={`h-2 w-2 rounded-full ${o.dot}`} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Método de pago y estado en un solo selector: el botón resume ambos y el popover los edita.
function PaymentSelector({ isExpense, method, setMethod, status, setStatus, dueDate, setDueDate }) {
  const { open, setOpen, rect, rootRef, triggerRef, toggleOpen } = useDropdown();
  const pending = status === "Pendiente";
  const green = categoryTone("green").dot;
  const amber = categoryTone("amber").dot;
  const pendingLabel = isExpense ? "Por pagar" : "Por cobrar";
  const text = `${method} · ${pending ? (dueDate ? `vence ${fmtDate(dateOf(dueDate))}` : pendingLabel) : isExpense ? "Pagado" : "Cobrado"}`;
  const wide = pending && Boolean(dueDate);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, triggerRef]);

  return (
    <div ref={rootRef} style={{ width: wide ? 204 : 184 }} className="relative shrink-0 transition-[width]">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Método y estado: ${text}`}
        title={text}
        onClick={() => toggleOpen(284)}
        className="flex h-[38px] w-full items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-left text-[12.5px] font-semibold text-ink-2 outline-none transition hover:bg-surface-2 focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${pending ? amber : green}`} />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <IconChevronDown width={15} height={15} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Método y estado"
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
          className="z-[60] flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-3.5 shadow-modal"
        >
          <div>
            <p className="t-label mb-1.5">Método</p>
            <Segmented label="Método de pago" value={method} onChange={setMethod} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          </div>
          <div>
            <p className="t-label mb-1.5">Estado</p>
            <Segmented
              label="Estado del movimiento"
              value={status}
              onChange={setStatus}
              options={[
                { value: "Completado", label: isExpense ? "Pagado" : "Cobrado", dot: green },
                { value: "Pendiente", label: pendingLabel, dot: amber },
              ]}
            />
          </div>
          {pending ? (
            <label className="block rounded-[10px] bg-tone-amber px-3 py-2.5">
              <span className="mb-1 block text-[12px] font-semibold text-tone-amber-text">Vence</span>
              <input
                type="date"
                value={dueDate}
                min={todayInput()}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Fecha de vencimiento"
                className="h-9 w-full rounded-[8px] border border-tone-amber-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-select-bar"
              />
              <span className="mt-1 block text-[11.5px] text-tone-amber-strong">Solo aparece con «Por pagar»</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuickEntry({ categories, onSaved }) {
  const [type, setType] = useState("Gasto");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [status, setStatus] = useState("Completado");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [last, setLast] = useState(readLastCategory);
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(todayInput);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef(null);
  const conceptRef = useRef(null);
  const fileRef = useRef(null);
  const dateRef = useRef(null);

  const isExpense = type === "Gasto";
  // Las no archivadas, con la última usada primero (si ya no existe o está archivada, se ignora).
  const active = useMemo(() => {
    const list = categories.filter((c) => !c.archived);
    const first = list.find((c) => c.name === last);
    return first ? [first, ...list.filter((c) => c !== first)] : list;
  }, [categories, last]);
  const chosen = active.some((c) => c.name === category) ? category : active.some((c) => c.name === last) ? last : "";
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: false } : e));

  const isToday = date === todayInput();
  const dateLabel = !date || isToday ? "Hoy" : fmtDate(dateOf(date));

  function pickFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const error = invoiceError(picked);
    if (error) return toast.error(error);
    setFile(picked);
  }

  function openDatePicker() {
    try {
      dateRef.current?.showPicker();
    } catch {
      dateRef.current?.focus();
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const value = Number(amount);
    const problem = !(value > 0)
      ? ["amount", "Escribe un monto mayor que 0", amountRef]
      : !concept.trim()
        ? ["concept", "Escribe el concepto", conceptRef]
        : isExpense && !chosen
          ? ["category", "Elige la categoría del gasto", null]
          : null;
    if (problem) {
      setErrors({ [problem[0]]: true });
      toast.error(problem[1]);
      problem[2]?.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/transactions", {
        concept: concept.trim(),
        type,
        amount: value,
        status,
        date: date || undefined,
        paymentMethod: method,
        ...(isExpense ? { category: chosen } : {}),
        ...(status === "Pendiente" && dueDate ? { dueDate } : {}),
      });
      toast.success(`${isExpense ? "Gasto" : "Ingreso"} ${res.reference} registrado`);
      if (file) {
        try {
          const form = new FormData();
          form.append("file", file);
          await api.post(`/transactions/${res._id}/attachment`, form);
        } catch (err) {
          toast.error(`La factura no se pudo subir (${err.message}). El movimiento quedó guardado.`);
        }
      }
      if (isExpense) {
        setCategory(chosen);
        setLast(chosen);
        writeLastCategory(chosen);
      }
      setAmount("");
      setConcept("");
      setFile(null);
      setDate(todayInput());
      setDueDate("");
      setStatus("Completado");
      setErrors({});
      onSaved?.(res._id);
      amountRef.current?.focus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface px-3 py-[11px] xl:flex-nowrap" aria-label="Registro rápido">
      <div role="group" aria-label="Tipo de movimiento" className="inline-flex h-[38px] shrink-0 rounded-[10px] border border-line bg-surface-2 p-0.5">
        <button
          type="button"
          aria-pressed={isExpense}
          onClick={() => setType("Gasto")}
          className={`h-8 rounded-[8px] px-2.5 text-[12.5px] font-semibold transition ${isExpense ? "bg-tone-rose text-tone-rose-text" : "text-muted hover:text-ink"}`}
        >
          − Gasto
        </button>
        <button
          type="button"
          aria-pressed={!isExpense}
          onClick={() => setType("Ingreso")}
          className={`h-8 rounded-[8px] px-2.5 text-[12.5px] font-semibold transition ${!isExpense ? "bg-tone-green text-tone-green-text" : "text-muted hover:text-ink"}`}
        >
          + Ingreso
        </button>
      </div>

      <div className="relative w-[110px] shrink-0">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">$</span>
        <input
          ref={amountRef}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Monto"
          aria-invalid={errors.amount || undefined}
          value={amount}
          onKeyDown={blockNegativeKey}
          onChange={(e) => {
            setAmount(e.target.value);
            clearError("amount");
          }}
          className={`${fieldClass} w-full pl-6 tabular-nums ${errors.amount ? "border-tone-rose-dot" : "border-line"}`}
        />
      </div>

      <input
        ref={conceptRef}
        type="text"
        placeholder="¿En qué? Ej. combustible del camión"
        aria-label="Concepto"
        aria-invalid={errors.concept || undefined}
        value={concept}
        onChange={(e) => {
          setConcept(e.target.value);
          clearError("concept");
        }}
        className={`${fieldClass} min-w-0 basis-full xl:min-w-[120px] xl:flex-1 xl:basis-0 ${errors.concept ? "border-tone-rose-dot" : "border-line"}`}
      />

      <CategoryCombobox
        categories={active}
        value={chosen}
        last={last}
        income={!isExpense}
        invalid={Boolean(errors.category)}
        onChange={(name) => {
          setCategory(name);
          clearError("category");
        }}
      />

      <PaymentSelector isExpense={isExpense} method={method} setMethod={setMethod} status={status} setStatus={setStatus} dueDate={dueDate} setDueDate={setDueDate} />

      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickFile} />
      {file ? (
        <span className="inline-flex h-[38px] shrink-0 items-center rounded-[10px] bg-primary-soft text-primary-soft-text" title={file.name}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={`Factura adjunta: ${file.name}. Cambiar archivo`}
            className="inline-flex h-full items-center gap-1 rounded-l-[10px] pl-2.5 pr-1 text-[12.5px] font-semibold"
          >
            <IconPaperclip width={15} height={15} />1
          </button>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Quitar la factura"
            className="mr-1 flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface/70"
          >
            <IconClose width={12} height={12} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Adjuntar factura"
          title="Adjuntar factura"
          className={`${iconButtonClass} w-[38px] border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink`}
        >
          <IconPaperclip width={16} height={16} />
        </button>
      )}

      <span className="relative shrink-0">
        <button
          type="button"
          onClick={openDatePicker}
          aria-label={`Fecha del movimiento: ${isToday ? `hoy, ${fmtDate(new Date())}` : fmtDate(dateOf(date))}`}
          title="Cambiar la fecha del movimiento"
          className={`${iconButtonClass} px-2.5 ${isToday ? "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink" : "border-transparent bg-primary-soft text-primary-soft-text"}`}
        >
          <IconCalendar width={15} height={15} />
          {dateLabel}
        </button>
        <input
          ref={dateRef}
          type="date"
          value={date}
          max={todayInput()}
          onChange={(e) => setDate(e.target.value)}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
        />
      </span>

      <Button type="submit" size="header" icon={IconCheck} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

export default QuickEntry;
