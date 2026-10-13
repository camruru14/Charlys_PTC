import { useState } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, compactNumber, labelStep, niceScale } from "./chartUtils";

/*
  Gráfica de columnas con SVG propio (un solo eje, cuadrícula de 1 px muy suave). Las columnas miden
  como máximo 24 px y tienen las esquinas de arriba redondeadas a 4 px.
    data          [{ key, label, value, target? }]
    color         color de las columnas
    targetLabel   texto de la meta («Meta»): si TODOS los días tienen la misma meta se dibuja una
                  línea punteada con «Meta 21k»; si varía, una raya corta sobre cada columna
    renderTooltip (index) => nodo del globo (el área de toque es todo el casillero)
    ariaLabel     resumen para lectores de pantalla
  El último valor lleva su cifra encima.
*/
const MARGIN = { left: 42, right: 12, top: 18, bottom: 22 };
const MAX_BAR = 24;

// Rectángulo con las dos esquinas de arriba redondeadas.
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
}

function ColumnChart({ data = [], color, targetLabel = "Meta", renderTooltip, ariaLabel, className = "" }) {
  const [ref, { width, height }] = useElementSize();
  const [hover, setHover] = useState(-1);
  const count = data.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && height > 0 && count > 0 && plotW > 0 && plotH > 0;

  const targets = data.map((d) => Number(d.target) || 0);
  const hasTargets = targets.some((t) => t > 0);
  const sameTarget = hasTargets && targets.every((t) => t === targets[0]);
  const { max, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value), ...targets));

  const band = plotW / (count || 1);
  const barW = Math.min(MAX_BAR, band * 0.7);
  const cx = (i) => MARGIN.left + (i + 0.5) * band;
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;
  const step = labelStep(count, plotW, 34);
  const lastIndex = count - 1;

  return (
    <div ref={ref} className={`relative min-h-0 flex-1 ${className}`}>
      {ready ? (
        <>
          <svg
            role="img"
            aria-label={ariaLabel}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onPointerMove={(e) => setHover(bandIndexAt(e.clientX - e.currentTarget.getBoundingClientRect().left, MARGIN.left, plotW, count))}
            onPointerLeave={() => setHover(-1)}
            className="block touch-pan-y"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--color-line-soft)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[11px] tabular-nums">
                  {compactNumber(t)}
                </text>
              </g>
            ))}
            {hover >= 0 ? <rect x={MARGIN.left + hover * band} y={MARGIN.top} width={band} height={plotH} fill="var(--color-surface-2)" /> : null}

            {data.map((d, i) => (
              <g key={d.key}>
                {d.value > 0 ? <path d={topRounded(cx(i) - barW / 2, y(d.value), barW, MARGIN.top + plotH - y(d.value), 4)} fill={color} /> : null}
                {hasTargets && !sameTarget && targets[i] > 0 ? (
                  <line x1={cx(i) - barW / 2 - 3} x2={cx(i) + barW / 2 + 3} y1={y(targets[i])} y2={y(targets[i])} stroke="var(--color-ink-2)" strokeWidth={2} strokeLinecap="round" />
                ) : null}
                {i % step === 0 || i === lastIndex ? (
                  <text x={cx(i)} y={height - 6} textAnchor="middle" className="fill-subtle text-[11px]">
                    {d.label}
                  </text>
                ) : null}
              </g>
            ))}

            {sameTarget ? (
              <g>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(targets[0])} y2={y(targets[0])} stroke="var(--color-ink-2)" strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={MARGIN.left + 4} y={y(targets[0]) - 5} className="fill-ink-2 text-[11px] font-semibold">
                  {targetLabel} {compactNumber(targets[0])}
                </text>
              </g>
            ) : null}

            {data[lastIndex] && data[lastIndex].value > 0 ? (
              <text x={cx(lastIndex)} y={y(data[lastIndex].value) - 5} textAnchor="middle" className="fill-ink text-[11px] font-semibold tabular-nums">
                {compactNumber(data[lastIndex].value)}
              </text>
            ) : null}
            <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="transparent" />
          </svg>
          {hover >= 0 && renderTooltip ? (
            <ChartTooltip x={cx(hover)} y={MARGIN.top} containerWidth={width}>
              {renderTooltip(hover)}
            </ChartTooltip>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default ColumnChart;
