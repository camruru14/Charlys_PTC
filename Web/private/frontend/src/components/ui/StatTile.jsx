/*
  Tile interno (dentro de una tarjeta o un detalle): etiqueta, valor y nota.
  Si recibe `children`, se pintan en lugar de value/note (ej. los tiles
  Cliente/Entrega/Fechas de la ficha de un pedido).
  valueClassName / noteClassName cambian el color del valor o de la nota
  (p. ej. text-tone-green-text para una nota en verde).
*/
function StatTile({ label, value, note, className = "", valueClassName = "text-ink", noteClassName = "", children }) {
  return (
    <div className={`rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3 ${className}`}>
      <p className="t-label">{label}</p>
      {children != null ? (
        <div className="mt-1.5">{children}</div>
      ) : (
        <>
          <p className={`mt-1 text-[20px] font-semibold tabular-nums ${valueClassName}`}>{value}</p>
          {note ? <p className={`t-aux mt-0.5 ${noteClassName}`}>{note}</p> : null}
        </>
      )}
    </div>
  );
}

export default StatTile;
