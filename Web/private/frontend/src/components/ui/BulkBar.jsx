/*
  Barra de acciones en bloque: aparece cuando hay registros seleccionados.
  Renglón 1: ícono de casilla, «N seleccionados», acciones y «Cancelar».
  Renglón 2 (opcional): nota de 11px en muted, alineada con el texto.
*/
function BulkBar({ count, label = "seleccionados", onClear, clearLabel = "Cancelar", note, children }) {
  if (!count) return null;
  return (
    <div className="flex flex-col gap-1 border-b border-line-soft bg-select-bg px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-primary text-white" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17 19 7" />
          </svg>
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums text-ink">
          {count} {label}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {children}
          {onClear ? (
            <button type="button" onClick={onClear} className="h-[29px] rounded-[8px] px-2.5 text-[12.5px] font-semibold text-ink-2 hover:bg-surface">
              {clearLabel}
            </button>
          ) : null}
        </div>
      </div>
      {note ? <p className="pl-[26px] text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}

export default BulkBar;
