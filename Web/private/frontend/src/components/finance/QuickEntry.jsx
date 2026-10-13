import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Button from "../ui/Button";
import { FilterSelect } from "../ui/Field";
import { IconCheck, IconClose, IconPaperclip } from "../../lib/icons";
import { categoryIcon, categoryTone } from "../../lib/expenseCategories";
import { filterSelectClass } from "../../lib/filterStyles";
import { blockNegativeKey } from "../../lib/numberInput";
import { invoiceError, PAYMENT_METHODS } from "../../lib/finance";
import { fmtDate } from "../../lib/format";
import { todayInput } from "../../hooks/useBatchForm";

/*
  Registro rápido de Finanzas: una tarjeta de dos filas para anotar un gasto
  (o un ingreso que no es venta de la tienda) sin abrir un formulario.
    Fila 1: tipo · monto · concepto · método · estado (· vence) · Guardar
    Fila 2: categoría (chips) · adjuntar factura · fecha
  Enter en cualquier campo guarda. Tras guardar se limpian monto, concepto,
  factura, fecha y vencimiento (el estado vuelve a «Pagado»); se conservan tipo, categoría y método, y el foco vuelve al monto.
*/

const fieldClass =
  "h-9 rounded-[10px] border bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";
const selectClass = `${filterSelectClass} !min-w-0 w-[150px]`;

// «Hoy, 12 oct» o «9 oct» para el campo de fecha del movimiento.
function dateText(value) {
  if (!value) return "Elegir fecha";
  const label = fmtDate(new Date(`${value}T00:00:00`));
  return value === todayInput() ? `Hoy, ${label}` : label;
}

function QuickEntry({ categories, onSaved }) {
  const [type, setType] = useState("Gasto");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [status, setStatus] = useState("Completado");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(todayInput);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef(null);
  const conceptRef = useRef(null);
  const fileRef = useRef(null);
  const dateRef = useRef(null);

  const isExpense = type === "Gasto";
  const active = categories.filter((c) => !c.archived);
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: false } : e));

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
        : isExpense && !category
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
        ...(isExpense ? { category } : {}),
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
    <form onSubmit={submit} className="rounded-[14px] border border-line bg-surface px-5 py-4" aria-label="Registro rápido">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="t-card-title">Registro rápido</h2>
        <span className="t-aux">Las ventas de la tienda entran solas; aquí anotas lo demás.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Tipo de movimiento" className="inline-flex h-9 shrink-0 rounded-[10px] border border-line bg-surface-2 p-0.5">
          <button
            type="button"
            aria-pressed={isExpense}
            onClick={() => setType("Gasto")}
            className={`h-8 rounded-[8px] px-3 text-[12.5px] font-semibold transition ${isExpense ? "bg-tone-rose text-tone-rose-text" : "text-muted hover:text-ink"}`}
          >
            − Gasto
          </button>
          <button
            type="button"
            aria-pressed={!isExpense}
            onClick={() => setType("Ingreso")}
            className={`h-8 rounded-[8px] px-3 text-[12.5px] font-semibold transition ${!isExpense ? "bg-tone-green text-tone-green-text" : "text-muted hover:text-ink"}`}
          >
            + Otro ingreso
          </button>
        </div>

        <div className="relative w-[120px] shrink-0">
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
          className={`${fieldClass} min-w-[180px] flex-1 ${errors.concept ? "border-tone-rose-dot" : "border-line"}`}
        />

        <FilterSelect
          label="Método"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          className={selectClass}
        />
        <FilterSelect
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "Completado", label: "Pagado" },
            { value: "Pendiente", label: isExpense ? "Por pagar" : "Por cobrar" },
          ]}
          className={selectClass}
        />
        {status === "Pendiente" ? (
          <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 text-[12.5px] text-muted focus-within:border-select-bar">
            <span className="font-semibold">Vence</span>
            <input
              type="date"
              value={dueDate}
              min={todayInput()}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Fecha de vencimiento"
              className="bg-transparent text-[12.5px] text-ink outline-none"
            />
          </label>
        ) : null}

        <Button type="submit" size="modal" icon={IconCheck} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[320px] flex-wrap items-center gap-1.5" role="group" aria-label="Categoría">
          <span className={`t-label mr-1 ${errors.category ? "!text-tone-rose-text" : ""}`}>Categoría</span>
          {isExpense ? (
            active.length ? (
              active.map((c) => {
                const Icon = categoryIcon(c.icon);
                const tone = categoryTone(c.color);
                const selected = category === c.name;
                return (
                  <button
                    key={c._id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(selected ? "" : c.name);
                      clearError("category");
                    }}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-semibold transition ${
                      selected ? `${tone.soft} ${tone.border}` : `bg-surface text-ink-2 hover:bg-surface-2 ${errors.category ? "border-tone-rose-dot/60" : "border-line"}`
                    }`}
                  >
                    <Icon width={13} height={13} className={selected ? "" : "text-subtle"} />
                    {c.name}
                  </button>
                );
              })
            ) : (
              <span className="t-aux">Aún no hay categorías: créalas en Configuración › Categorías de gasto.</span>
            )
          ) : (
            <span className="t-aux">Se registra como «Otros ingresos».</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickFile} />
          {file ? (
            <span className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-full bg-primary-soft pl-2.5 pr-1 text-[12px] font-semibold text-primary-soft-text">
              <IconPaperclip width={13} height={13} className="shrink-0" />
              <span className="truncate" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Quitar la factura"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-surface/70"
              >
                <IconClose width={12} height={12} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-soft-text transition hover:text-primary"
            >
              <IconPaperclip width={14} height={14} />
              Adjuntar factura
            </button>
          )}

          <span className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className="rounded-[8px] px-1.5 py-1 text-[12.5px] font-semibold text-ink-2 underline decoration-dashed decoration-faint underline-offset-4 transition hover:text-ink"
              title="Cambiar la fecha del movimiento"
            >
              {dateText(date)}
            </button>
            <input
              ref={dateRef}
              type="date"
              value={date}
              max={todayInput()}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha del movimiento"
              tabIndex={-1}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
            />
          </span>
        </div>
      </div>
    </form>
  );
}

export default QuickEntry;
