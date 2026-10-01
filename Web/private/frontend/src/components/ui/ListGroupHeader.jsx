/*
  Encabezado de sección dentro de una lista maestro (Logística): nombre del
  grupo y cuántos elementos tiene. Se queda fijo arriba al hacer scroll.
    <ListGroupHeader label="Listos para ruta" count={3} />
*/
function ListGroupHeader({ label, count }) {
  return (
    <div className="sticky top-0 z-[1] flex h-8 items-center justify-between gap-3 border-b border-line-soft bg-surface-2 px-3.5">
      <span className="t-label">{label}</span>
      <span className="t-aux tabular-nums">{count}</span>
    </div>
  );
}

export default ListGroupHeader;
