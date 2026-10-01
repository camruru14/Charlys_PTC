/*
  Campos de formulario reutilizables con estilo consistente del panel.
  - Field: input de texto/número/email/etc.
  - SelectField: desplegable propio (botón + panel flotante, no <select>
    nativo) — es el único mecanismo de dropdown en todo el sistema: el popup
    del navegador no se puede maquillar ni limitar en alto con CSS, y
    "position: fixed" (calculado en píxeles contra el botón, ver useDropdown)
    evita que un ancestro con overflow-y-auto (como el contenido de
    Modal.jsx) lo recorte. `size="sm"` da la variante compacta (ver
    Producto/Color en el modal de pedidos). `disabled` bloquea el campo, y una
    opción { value, label, disabled: true } se ve pero no se puede elegir.
  - FilterSelect: la misma mecánica que SelectField pero sin label, para las
    barras de filtros (Logística, Inventario, Fabricación, y los toolbars de
    Lotes/Transacciones) — el tamaño del botón lo define cada caller vía
    `className` (mismo que ya tenían esos filtros, solo cambió el mecanismo).
  - TextareaField: área de texto.
*/

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconEye, IconEyeOff } from "../../lib/icons";

const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";
const controlClass =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

// Variante compacta de labelClass/controlClass (antes vivía como
// compactLabelClass/compactControlClass solo en Pedidos.jsx, para la fila de
// "agregar producto" del modal de pedido).
const compactLabelClass = "mb-1 block text-[11.5px] font-semibold text-muted";
const compactControlClass =
  "w-full rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

export function Field({ label, name, type = "text", value, onChange, required, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required ? <span className="text-tone-rose-text">*</span> : null}
      </span>
      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={controlClass}
        {...rest}
      />
    </label>
  );
}

// Campo de contraseña con el botón de ojo para mostrar u ocultar lo que se
// está escribiendo (no revela nada guardado: solo cambia el type del input).
export function PasswordField({ label, name, value, onChange, required, placeholder, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      {label ? (
        <span className={labelClass}>
          {label} {required ? <span className="text-tone-rose-text">*</span> : null}
        </span>
      ) : null}
      <span className="relative block">
        <input
          name={name}
          type={visible ? "text" : "password"}
          value={value ?? ""}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`${controlClass} pr-10`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[10px] text-muted transition hover:text-ink"
        >
          {/* El ícono muestra el estado: tachado = oculta, abierto = visible. */}
          {visible ? <IconEye width={16} height={16} /> : <IconEyeOff width={16} height={16} />}
        </button>
      </span>
    </label>
  );
}

// Mecánica compartida por todo dropdown propio del panel (SelectField y
// FilterSelect): abre/cierra, calcula la posición fija del panel contra el
// botón disparador, y lo cierra si la ventana cambia de tamaño o se hace
// scroll afuera del panel — el scroll DENTRO de la lista de opciones no
// cuenta, así se puede bajar para ver más sin que se cierre solo (ver el
// porqué de position: fixed en vez de absolute: un ancestro con
// overflow-y-auto, como el contenido de Modal.jsx, recorta un panel
// absolute aunque su posición esté bien calculada).
function useDropdown() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleResize() {
      setOpen(false);
    }
    function handleScroll(e) {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      setOpen(false);
    }
    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  }

  return { open, setOpen, rect, rootRef, triggerRef, toggleOpen };
}

// Panel flotante de opciones, compartido por SelectField y FilterSelect.
function DropdownOptions({ rect, options, value, onSelect }) {
  return (
    <div
      style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
      className="z-[60] max-h-52 overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-modal"
    >
      {options.length === 0 ? (
        <p className="px-3.5 py-2 text-[13px] text-faint">Sin opciones</p>
      ) : (
        options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          // Una opción { value, label, disabled: true } se ve pero no se puede elegir.
          const disabled = typeof opt !== "string" && Boolean(opt.disabled);
          return (
            <button
              key={val}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className={`block w-full px-3.5 py-2 text-left text-[13px] ${
                disabled
                  ? "cursor-not-allowed text-faint"
                  : `hover:bg-surface-2 ${val === value ? "bg-select-bg font-semibold text-primary-soft-text" : "text-ink-2"}`
              }`}
            >
              {text}
            </button>
          );
        })
      )}
    </div>
  );
}

// onChange se llama con un evento sintético ({ target: { name, value } })
// para que los handlers existentes (los mismos que ya usaban <select>)
// funcionen sin cambios.
export function SelectField({ label, name, value, onChange, options = [], required, placeholder, size = "md", disabled = false }) {
  const { open, setOpen, rect, rootRef, triggerRef, toggleOpen } = useDropdown();
  const compact = size === "sm";

  const selected = options.find((opt) => (typeof opt === "string" ? opt : opt.value) === value);
  const selectedLabel = selected ? (typeof selected === "string" ? selected : selected.label) : null;

  function selectOption(opt) {
    const val = typeof opt === "string" ? opt : opt.value;
    onChange({ target: { name, value: val } });
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <span className={compact ? compactLabelClass : labelClass}>
        {label} {required ? <span className="text-tone-rose-text">*</span> : null}
      </span>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={disabled}
        className={`${compact ? compactControlClass : controlClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70`}
      >
        <span className={selectedLabel ? "text-ink" : "text-faint"}>
          {selectedLabel || placeholder || "Selecciona…"}
        </span>
        <IconChevronDown width={16} height={16} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled ? <DropdownOptions rect={rect} options={options} value={value} onSelect={selectOption} /> : null}
    </div>
  );
}

// Dropdown propio sin label, misma mecánica que SelectField, para las barras
// de filtros: cada caller sigue trayendo su propia "opción X: Todos" como
// primer elemento de `options` (igual que antes con <option value="">), y
// su propio tamaño de botón vía `className`.
export function FilterSelect({ value, onChange, options = [], className = "" }) {
  const { open, setOpen, rect, rootRef, triggerRef, toggleOpen } = useDropdown();

  const selected = options.find((opt) => (typeof opt === "string" ? opt : opt.value) === value);
  const selectedLabel = selected ? (typeof selected === "string" ? selected : selected.label) : "";

  function selectOption(opt) {
    const val = typeof opt === "string" ? opt : opt.value;
    onChange({ target: { value: val } });
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleOpen}
        className={`flex items-center justify-between gap-1.5 text-left ${className}`}
      >
        <span>{selectedLabel}</span>
        <IconChevronDown width={14} height={14} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <DropdownOptions rect={rect} options={options} value={value} onSelect={selectOption} /> : null}
    </div>
  );
}

// Valor de solo lectura con la misma etiqueta que un campo (p. ej. el número
// de lote autogenerado).
export function ReadonlyField({ label, value }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex min-h-[38px] items-center rounded-[10px] border border-dashed border-line bg-surface-2 px-3 text-[13px] font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

export function TextareaField({ label, name, value, onChange, rows = 3, placeholder }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        name={name}
        value={value ?? ""}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className={controlClass}
      />
    </label>
  );
}

export default Field;
