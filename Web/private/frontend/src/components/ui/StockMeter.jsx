import ProgressBar from "./ProgressBar";

/*
  Medidor de existencia: barra de 6px sobre line-soft + etiqueta.
  El tono sale de la relación con el mínimo: bajo mínimo rosa, hasta el doble
  del mínimo azul (estable) y por encima verde (suficiente).
*/
function StockMeter({ stock = 0, min = 0, max, label }) {
  const top = max || Math.max(min * 3, stock, 1);
  const tone = stock < min ? "rose" : stock <= min * 2 ? "blue" : "green";
  return (
    <div className="flex min-w-[120px] items-center gap-2.5">
      <ProgressBar value={stock} max={top} tone={tone} className="flex-1" />
      {label != null ? <span className="t-aux shrink-0 tabular-nums">{label}</span> : null}
    </div>
  );
}

export default StockMeter;
