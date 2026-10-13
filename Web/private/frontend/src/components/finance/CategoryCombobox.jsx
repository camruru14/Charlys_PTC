import { createElement, useMemo, useState } from "react";
import { DropdownOptions } from "../ui/Field";
import { useDropdown } from "../../hooks/useDropdown";
import { IconCash, IconChevronDown, IconSearch } from "../../lib/icons";
import { categoryIcon, categoryTone } from "../../lib/expenseCategories";

/*
  Categoría del registro rápido de Finanzas, en un combobox de 176 px: cerrado muestra el avatar
  (ícono y color) y el nombre; abierto, un panel con buscador y la lista de categorías (4 filas
  visibles y scroll, con check en la elegida). La mecánica del panel es la de los demás dropdowns
  del panel (useDropdown / DropdownOptions de ui/Field). Teclado: flechas y Enter eligen, Escape
  cierra, y escribir con el botón enfocado abre el panel ya filtrado. Con un ingreso no hay
  categoría que elegir: se muestra un bloque fijo «Otros ingresos».
*/

const WIDTH = 176;
const PANEL_WIDTH = 264;
const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// El ícono se crea con createElement: categoryIcon() devuelve un componente según el dato.
function categoryAvatar(icon, color, size = 22) {
  return (
    <span style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-[7px] ${categoryTone(color).soft}`}>
      {createElement(categoryIcon(icon), { width: Math.round(size * 0.55), height: Math.round(size * 0.55) })}
    </span>
  );
}

// `categories`: las no archivadas, con la última usada primero. `last`: nombre de esa última.
function CategoryCombobox({ categories, value, onChange, invalid = false, income = false, last = "" }) {
  const { open, setOpen, rect, rootRef, triggerRef, toggleOpen } = useDropdown();
  const [query, setQuery] = useState("");
  const [activeName, setActiveName] = useState("");

  const options = useMemo(() => categories.map((c) => ({ value: c.name, label: c.name, avatar: categoryAvatar(c.icon, c.color) })), [categories]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o.label).includes(q)) : options;
  }, [options, query]);
  const active = filtered.some((o) => o.value === activeName) ? activeName : (filtered[0]?.value ?? "");
  const selected = categories.find((c) => c.name === value);

  if (income) {
    return (
      <div style={{ width: WIDTH }} className="flex h-[38px] shrink-0 items-center gap-2 rounded-[10px] border border-dashed border-line px-2.5 text-[13px] font-semibold text-ink-2" title="Los ingresos se registran como «Otros ingresos»">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-tone-green text-tone-green-text">
          <IconCash width={12} height={12} />
        </span>
        <span className="truncate">Otros ingresos</span>
      </div>
    );
  }

  function openPanel(initialQuery = "") {
    if (open) return;
    setQuery(initialQuery);
    setActiveName(value);
    toggleOpen(PANEL_WIDTH);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(name) {
    onChange(name);
    close();
  }

  function move(step) {
    if (!filtered.length) return;
    const index = filtered.findIndex((o) => o.value === active);
    setActiveName(filtered[(index + step + filtered.length) % filtered.length].value);
  }

  function onTriggerKeyDown(e) {
    if (open || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openPanel();
    } else if (e.key.length === 1 && e.key !== " ") {
      e.preventDefault();
      openPanel(e.key);
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const header = categories.length ? (
    <div className="border-b border-line-soft p-2">
      <div className="relative">
        <IconSearch width={14} height={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Buscar categoría"
          aria-label="Buscar categoría"
          className="h-8 w-full rounded-[8px] border border-line bg-surface-2 pl-8 pr-2.5 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:bg-surface"
        />
      </div>
    </div>
  ) : null;

  const footer =
    last && !query && categories.some((c) => c.name === last) ? (
      <p className="border-t border-line-soft px-3.5 py-2 text-[11.5px] text-muted">Arriba, la última que usaste</p>
    ) : null;

  return (
    <div ref={rootRef} style={{ width: WIDTH }} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Categoría"
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`flex h-[38px] w-full items-center gap-2 rounded-[10px] border bg-surface px-2.5 text-left text-[13px] outline-none transition focus:border-select-bar focus:ring-2 focus:ring-primary-soft ${
          invalid ? "border-tone-rose-dot" : "border-line"
        }`}
      >
        {selected ? categoryAvatar(selected.icon, selected.color) : null}
        <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold text-ink" : "text-faint"}`}>{selected ? selected.name : "Categoría"}</span>
        <IconChevronDown width={15} height={15} className={`shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <DropdownOptions
          rect={rect}
          options={filtered}
          value={value}
          activeValue={active}
          check
          header={header}
          footer={footer}
          emptyText={categories.length ? "Sin resultados" : "Aún no hay categorías: créalas en Configuración › Categorías de gasto"}
          onSelect={(opt) => choose(opt.value)}
        />
      ) : null}
    </div>
  );
}

export default CategoryCombobox;
