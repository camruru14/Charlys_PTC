import { useRef, useState } from "react";
import toast from "react-hot-toast";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { useFitPageSize } from "../../hooks/useFitPageSize";

/*
  Piezas de las listas de Configuración (Bodegas, Vehículos, Líneas de
  producción, Personal y permisos): una tarjeta que se estira con la
  pantalla, filas de alto fijo y paginación solo cuando los registros no
  caben en la tarjeta.
*/

// Alto de ListRow (58px, borde incluido): con él se calcula cuántas filas caben.
const ROW_HEIGHT = 58;

// Fila de alto fijo. No es un botón: solo sus íconos o su nombre hacen algo.
export function ListRow({ children, className = "" }) {
  return <div className={`flex h-[58px] w-full items-center gap-3 border-b border-line-soft px-5 text-left ${className}`}>{children}</div>;
}

/*
  items + renderRow(item): la tarjeta decide qué página se ve.
  resetKey: al cambiar (p. ej. búsqueda o filtro) vuelve a la primera página.
*/
export function ListCard({
  title,
  subtitle,
  action,
  toolbar,
  items,
  renderRow,
  rowHeight = ROW_HEIGHT,
  loading,
  error,
  emptyText,
  noun,
  resetKey = "",
}) {
  const listRef = useRef(null);
  const size = useFitPageSize(listRef, rowHeight);
  // La página vuelve a 0 cuando cambia resetKey (sin efecto: se guarda junto a la clave).
  const [pageState, setPageState] = useState({ key: resetKey, page: 0 });
  const total = items.length;
  const paged = Number.isFinite(size) && total > size;
  const pages = paged ? Math.ceil(total / size) : 1;
  const page = Math.min(pageState.key === resetKey ? pageState.page : 0, pages - 1);
  const visible = paged ? items.slice(page * size, page * size + size) : items;

  let body;
  if (loading && !total) body = <EmptyState title="Cargando…" />;
  else if (error) body = <EmptyState title="No se pudo cargar la lista" description={error} />;
  else if (!total) body = <EmptyState title={emptyText} />;
  else body = visible.map(renderRow);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-5 pb-3.5 pt-4">
        <div className="min-w-0">
          <h2 className="t-card-title">{title}</h2>
          {subtitle ? <p className="t-aux mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {toolbar ? <div className="flex shrink-0 flex-col gap-2.5 border-t border-line-soft px-5 py-3">{toolbar}</div> : null}
      <div ref={listRef} className="min-h-0 flex-1 overflow-hidden border-t border-line-soft">
        {body}
      </div>
      {paged ? <Pagination page={page} size={size} total={total} noun={noun} onChange={(p) => setPageState({ key: resetKey, page: p })} /> : null}
    </section>
  );
}

export function RowIcon({ icon: Icon }) {
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-line-soft bg-surface-2 text-muted">
      <Icon width={16} height={16} />
    </span>
  );
}

export function RowText({ title, detail, muted = false }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-[13.5px] font-semibold ${muted ? "text-muted" : "text-ink"}`}>{title}</span>
      <span className="t-aux block truncate tabular-nums">{detail}</span>
    </span>
  );
}

/*
  Botón de ícono de una fila (editar, eliminar). Deshabilitado, el title
  explica por qué (p. ej. «la bodega tiene existencia»).
*/
export function RowAction({ icon: Icon, label, onClick, disabled = false, reason, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled && reason ? reason : label}
      className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-tone-rose-text enabled:hover:bg-tone-rose" : "text-ink-2 enabled:hover:bg-surface-2 enabled:hover:text-ink"
      }`}
    >
      <Icon width={14} height={14} />
    </button>
  );
}

/*
  Nombre editable en la misma fila: clic sobre el nombre → campo de texto;
  Enter o salir del campo guarda, Escape cancela. Solo el nombre activa la
  edición (el resto de la fila no hace nada).
    onSave(nuevo): promesa; si falla, el campo sigue abierto.
*/
export function InlineName({ value, detail, onSave, label = "nombre" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = draft.trim();
    if (!next) {
      toast.error(`El ${label} no puede quedar vacío`);
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span className="min-w-0 flex-1">
        <input
          autoFocus
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          aria-label={`Nuevo ${label}`}
          className="h-[26px] w-full max-w-[320px] rounded-[7px] border border-select-bar bg-surface px-2 text-[13.5px] font-semibold text-ink outline-none ring-2 ring-primary-soft"
        />
        <span className="t-aux block truncate">Enter para guardar · Esc para cancelar</span>
      </span>
    );
  }

  return (
    <span className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title={`Clic para cambiar el ${label}`}
        className="block max-w-full cursor-text truncate rounded-[4px] text-left text-[13.5px] font-semibold text-ink decoration-dashed decoration-faint underline-offset-4 hover:underline"
      >
        {value}
      </button>
      <span className="t-aux block truncate tabular-nums">{detail}</span>
    </span>
  );
}
