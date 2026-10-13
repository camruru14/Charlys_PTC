/*
  Globo de las gráficas: se coloca dentro de un contenedor `relative` en (x, y) (píxeles del
  contenedor) y se pasa a la izquierda del cursor si no cabe a su derecha. No recibe el mouse.
*/
function ChartTooltip({ x, y, containerWidth, children }) {
  const flip = x > containerWidth * 0.55;
  return (
    <div
      role="status"
      style={{ left: x, top: Math.max(0, y), transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, 0)` }}
      className="pointer-events-none absolute z-10 min-w-[120px] rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] shadow-modal"
    >
      {children}
    </div>
  );
}

// Fila «■ etiqueta ........ valor» del globo.
export function TooltipRow({ color, label, value, valueClass = "text-ink" }) {
  return (
    <div className="flex items-center justify-between gap-4 whitespace-nowrap">
      <span className="flex items-center gap-1.5 text-muted">
        {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
        {label}
      </span>
      <span className={`font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export default ChartTooltip;
