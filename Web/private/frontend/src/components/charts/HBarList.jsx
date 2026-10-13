import { Link } from "react-router-dom";
import { useElementSize } from "../../hooks/useElementSize";

/*
  Lista de barras horizontales (un solo color): etiqueta a la izquierda, la barra (SVG) y el número
  al final. La barra no lleva fondo: solo la barra de color, desde el inicio, de 12 px de alto y con
  el extremo derecho redondeado a 4 px. Las etiquetas (110 px) y los números (56 px) tienen ancho
  fijo, así que las barras de todas las listas empiezan y terminan alineadas. Reparte las filas en
  todo el alto disponible.
    rows       [{ key, label, value, display?, to? }]  (display: texto del número; to: enlace de la fila)
    color      color de las barras
    max        valor que llena la barra completa (por omisión, el mayor de las filas)
    ariaLabel  resumen para lectores de pantalla
  Cada fila es más alta que la barra, así que el área de toque es mayor que la marca.
*/
const BAR_HEIGHT = 12;
const RADIUS = 4;

// Rectángulo con solo el extremo derecho redondeado.
function rightRounded(w, h, r) {
  const radius = Math.min(r, w, h / 2);
  return `M0,0 H${w - radius} Q${w},0 ${w},${radius} V${h - radius} Q${w},${h} ${w - radius},${h} H0 Z`;
}

function Bar({ ratio, color }) {
  const [ref, { width }] = useElementSize();
  const w = Math.max(RADIUS, width * ratio);
  return (
    <div ref={ref} aria-hidden="true" className="min-w-0" style={{ height: BAR_HEIGHT }}>
      {width > 0 && ratio > 0 ? (
        <svg width={width} height={BAR_HEIGHT} viewBox={`0 0 ${width} ${BAR_HEIGHT}`} className="block">
          <path d={rightRounded(w, BAR_HEIGHT, RADIUS)} fill={color} />
        </svg>
      ) : null}
    </div>
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
        const grid = "grid min-h-[22px] w-full grid-cols-[110px_minmax(0,1fr)_56px] items-center gap-3 rounded-[8px] px-1.5";
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
