/*
  Encabezado de sección dentro de una lista maestro (Logística): nombre del
  grupo y cuántos elementos tiene. Se queda fijo arriba al hacer scroll.
    <ListGroupHeader label="Listos para ruta" count={3} />
  `note` (opcional): texto aclaratorio, en gris y más pequeño, junto al nombre.
*/
function ListGroupHeader({ label, count, note }) {
  return (
    <div className="sticky top-0 z-[1] flex h-8 items-center justify-between gap-3 border-b border-line-soft bg-surface-2 px-3.5">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="t-label shrink-0">{label}</span>
        {note ? <span className="truncate text-[11px] font-normal text-faint">· {note}</span> : null}
      </span>
      <span className="t-aux tabular-nums">{count}</span>
    </div>
  );
}

export default ListGroupHeader;
