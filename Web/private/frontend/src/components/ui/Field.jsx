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
    Una opción { value, label, dot, meta, muted } puede traer un punto de color
    (clase de fondo, p. ej. «bg-tone-blue-dot»), un texto a la derecha (meta,
    p. ej. un conteo) y verse en gris sin dejar de poder elegirse (muted). Con
    `label`, el botón muestra «label  valor  meta».
  - TextareaField: área de texto.
*/

import { useLayoutEffect, useRef, useState } from "react";
import { useDropdown } from "../../hooks/useDropdown";
import { IconCheck, IconChevronDown, IconEye, IconEyeOff } from "../../lib/icons";

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

// La lista de opciones muestra como máximo 4 filas de 36 px (más el relleno
// vertical de 4 px arriba y abajo y el borde de 1 px); con más opciones hace scroll.
const OPTION_HEIGHT = 36;
const VISIBLE_OPTIONS = 4;
const LIST_PADDING = 4;
const LIST_MAX_HEIGHT = VISIBLE_OPTIONS * OPTION_HEIGHT + LIST_PADDING * 2 + 2;

// Panel flotante de opciones, compartido por SelectField, FilterSelect y el combobox de categoría
// del registro rápido de Finanzas. Extras opcionales: `header` (p. ej. un buscador) y `footer`
// fuera de la lista que hace scroll; `activeValue` (fila resaltada con el teclado); `check` (marca
// la elegida con un check); `emptyText`; y una opción puede traer `avatar` (nodo a la izquierda).
export function DropdownOptions({ rect, options, value, onSelect, header, footer, activeValue, check = false, emptyText = "Sin opciones" }) {
  const listRef = useRef(null);
  const selectedRef = useRef(null);
  const activeRef = useRef(null);

  // La fila resaltada con el teclado siempre queda a la vista dentro de la lista.
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - LIST_PADDING;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + LIST_PADDING;
  }, [activeValue]);

  // Al abrir, si la opción seleccionada queda fuera de las filas visibles, la
  // lista se desplaza hasta mostrarla (sin animación). Se ajusta scrollTop de
  // la propia lista, no scrollIntoView, para no mover el modal ni la página.
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = selectedRef.current;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - LIST_PADDING;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + LIST_PADDING;
  }, []);

  return (
    <div
      style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
      className="z-[60] overflow-hidden rounded-[10px] border border-line bg-surface shadow-modal"
    >
      {header}
      <div ref={listRef} style={{ maxHeight: LIST_MAX_HEIGHT - 2 }} className="relative overflow-y-auto overscroll-contain py-1">
      {options.length === 0 ? (
        <p className="px-3.5 py-2 text-[13px] text-faint">{emptyText}</p>
      ) : (
        options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          // Una opción { value, label, disabled: true } se ve pero no se puede elegir.
          const disabled = typeof opt !== "string" && Boolean(opt.disabled);
          const dot = typeof opt === "string" ? null : opt.dot;
          const meta = typeof opt === "string" ? null : opt.meta;
          const muted = typeof opt !== "string" && Boolean(opt.muted);
          const avatar = typeof opt === "string" ? null : opt.avatar;
          const selected = val === value;
          const active = activeValue !== undefined && val === activeValue;
          return (
            <button
              key={val}
              ref={(el) => {
                if (selected) selectedRef.current = el;
                if (active) activeRef.current = el;
              }}
              type="button"
              disabled={disabled}
              title={text}
              onClick={() => onSelect(opt)}
              className={`flex h-9 w-full items-center px-3.5 text-left text-[13px] ${
                disabled
                  ? "cursor-not-allowed text-faint"
                  : `hover:bg-surface-2 ${active ? "bg-surface-2" : ""} ${selected ? "bg-select-bg font-semibold text-primary-soft-text" : muted ? "text-faint" : "text-ink-2"}`
              }`}
            >
              {avatar ? <span className="mr-2.5 flex shrink-0">{avatar}</span> : null}
              {dot ? <span className={`mr-2 h-2 w-2 shrink-0 rounded-full ${dot} ${muted ? "opacity-40" : ""}`} /> : null}
              <span className="block min-w-0 flex-1 truncate">{text}</span>
              {meta != null ? <span className={`ml-2 shrink-0 text-[12px] font-normal tabular-nums ${muted ? "text-faint" : "text-muted"}`}>{meta}</span> : null}
              {check && selected ? <IconCheck width={14} height={14} className="ml-2 shrink-0" /> : null}
            </button>
          );
        })
      )}
      </div>
      {footer}
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
        onClick={() => toggleOpen()}
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
export function FilterSelect({ value, onChange, options = [], className = "", label, panelMinWidth }) {
  const { open, setOpen, rect, rootRef, triggerRef, toggleOpen } = useDropdown();

  const selected = options.find((opt) => (typeof opt === "string" ? opt : opt.value) === value);
  const selectedLabel = selected ? (typeof selected === "string" ? selected : selected.label) : "";
  const selectedMeta = selected && typeof selected !== "string" ? selected.meta : null;

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
        onClick={() => toggleOpen(panelMinWidth)}
        className={`flex items-center justify-between gap-1.5 text-left ${className}`}
      >
        {label ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="shrink-0 font-normal text-muted">{label}</span>
            <span className="truncate">{selectedLabel}</span>
            {selectedMeta != null ? <span className="ml-auto shrink-0 text-[12px] font-normal tabular-nums text-muted">{selectedMeta}</span> : null}
          </span>
        ) : (
          <span>{selectedLabel}</span>
        )}
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
