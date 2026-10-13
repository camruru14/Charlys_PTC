import { Link } from "react-router-dom";

/*
  Lista de barras horizontales (un solo color): etiqueta a la izquierda, la barra (SVG) en el
  centro y el número al final. Reparte las filas en todo el alto disponible.
    rows       [{ key, label, value, display?, to? }]  (display: texto del número; to: enlace de la fila)
    color      color de las barras
    max        valor que llena la barra completa (por omisión, el mayor de las filas)
    ariaLabel  resumen para lectores de pantalla
  Cada fila es más alta que la barra, así que el área de toque es mayor que la marca.
*/
function Bar({ ratio, color }) {
  return (
    <svg aria-hidden="true" width="100%" height="14" className="block min-w-0">
      <rect x="0" y="0" width="100%" height="14" rx="4" fill="var(--color-line-soft)" />
      {ratio > 0 ? <rect x="0" y="0" width={`${Math.max(2, ratio * 100)}%`} height="14" rx="4" fill={color} /> : null}
    </svg>
  );
}

function HBarList({ rows = [], color, max, ariaLabel, className = "" }) {
  const top = max ?? Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <ul role="list" aria-label={ariaLabel} className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {rows.map((r) => {
        const inner = (
          <>
            <span className="truncate text-[12.5px] text-ink-2" title={r.label}>
              {r.label}
            </span>
            <Bar ratio={(Number(r.value) || 0) / top} color={color} />
            <span className="text-right text-[12.5px] font-semibold tabular-nums text-ink">{r.display ?? r.value}</span>
          </>
        );
        const grid = "grid min-h-[22px] w-full grid-cols-[minmax(84px,34%)_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-1.5";
        return (
          <li key={r.key} className="flex min-h-0 flex-1 items-center">
            {r.to ? (
              <Link to={r.to} className={`${grid} transition hover:bg-surface-2`}>
                {inner}
              </Link>
            ) : (
              <div className={grid}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default HBarList;
