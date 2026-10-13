import { useRef, useState } from "react";
import { fromInput } from "../../lib/calendar";
import { fmtDateYear } from "../../lib/format";
import { IconCalendar } from "../../lib/icons";
import DatePicker from "./DatePicker";

/*
  Campo de fecha de los formularios (en lugar de <Field type="date">): etiqueta + botón con ícono de
  calendario y la fecha («13 oct 2026») que abre el DatePicker propio del panel.
  onChange recibe un evento sintético ({ target: { name, value } }, value «AAAA-MM-DD»), igual que
  SelectField, para que los handlers de los formularios sigan igual. `required` bloquea el envío del
  formulario si no hay fecha (con un input oculto, como haría el campo nativo).
  Los estilos repiten los de Field (labelClass / controlClass).
*/

const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";
const controlClass =
  "flex w-full items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-left text-[13px] text-ink outline-none transition focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

function DateField({ label, name, value, onChange, min, max, required, shortcuts, placeholder = "Elige una fecha", disabled = false }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const date = fromInput(value);

  return (
    <div className="relative">
      <span className={labelClass}>
        {label} {required ? <span className="text-tone-rose-text">*</span> : null}
      </span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${date ? fmtDateYear(date) : "sin fecha"}`}
        onClick={() => setOpen((o) => !o)}
        className={`${controlClass} disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70`}
      >
        <IconCalendar width={15} height={15} className="shrink-0 text-subtle" />
        <span className={date ? "text-ink" : "text-faint"}>{date ? fmtDateYear(date) : placeholder}</span>
      </button>
      {required ? (
        <input tabIndex={-1} aria-hidden="true" required value={value || ""} onChange={() => {}} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
      ) : null}
      <DatePicker
        open={open}
        value={value}
        min={min}
        max={max}
        shortcuts={shortcuts}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        onChange={(next) => onChange({ target: { name, value: next } })}
      />
    </div>
  );
}

export default DateField;
