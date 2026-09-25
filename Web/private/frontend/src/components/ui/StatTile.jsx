/* Tile interno (dentro de una tarjeta o un detalle): etiqueta, valor y nota. */
function StatTile({ label, value, note, className = "" }) {
  return (
    <div className={`rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3 ${className}`}>
      <p className="t-label">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-ink">{value}</p>
      {note ? <p className="t-aux mt-0.5">{note}</p> : null}
    </div>
  );
}

export default StatTile;
