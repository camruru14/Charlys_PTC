/*
  Barra de acciones en bloque: aparece cuando hay registros seleccionados.
  Fondo band con texto band-text; las acciones van a la derecha.
*/
function BulkBar({ count, label = "seleccionados", onClear, children }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-band px-4 py-2.5 text-band-text">
      <div className="flex items-center gap-3 text-[13px] font-semibold">
        <span className="tabular-nums">
          {count} {label}
        </span>
        {onClear ? (
          <button type="button" onClick={onClear} className="text-[12px] font-semibold text-band-text/80 underline-offset-2 hover:underline">
            Limpiar
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default BulkBar;
