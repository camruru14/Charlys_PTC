/*
  Leyenda de una gráfica: va a la derecha del título de la tarjeta (prop `action` de ChartCard) o
  encima de la gráfica. items: [{ key, label, color, shape?: "line" | "square" }].
*/
function ChartLegend({ items = [], className = "" }) {
  return (
    <ul className={`flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-ink-2 ${className}`}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className={item.shape === "square" ? "h-2.5 w-2.5 rounded-[3px]" : "h-[3px] w-4 rounded-full"} style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export default ChartLegend;
