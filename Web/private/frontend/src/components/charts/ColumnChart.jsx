import { useState } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import { TARGET_COLOR } from "../../lib/chartColors";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, compactNumber, labelStep, niceScale } from "./chartUtils";

/*
  Gráfica de columnas con SVG propio (un solo eje, cuadrícula de 1 px muy suave). Las columnas miden
  como máximo 24 px y tienen las esquinas de arriba redondeadas a 4 px.
    data          [{ key, label, value, target? }]
    color         color de las columnas
    targetColor   color de la meta: una columna gris clara del mismo ancho DETRÁS de la producida (si
                  un día se pasó de la meta, la de color sobresale)
    renderTooltip (index) => nodo del globo (el área de toque es todo el casillero)
    ariaLabel     resumen para lectores de pantalla
  Solo el último valor lleva su cifra encima; si choca con la parte de arriba de la meta, se sube.
  La leyenda («Producido» / «Meta») la pone la página con ChartLegend.
*/
const MARGIN = { left: 42, right: 12, top: 18, bottom: 22 };
const MAX_BAR = 24;
const LABEL_HEIGHT = 14;

// Rectángulo con las dos esquinas de arriba redondeadas.
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
}

function ColumnChart({ data = [], color, targetColor = TARGET_COLOR, renderTooltip, ariaLabel, className = "" }) {
  const [ref, { width, height }] = useElementSize();
  const [hover, setHover] = useState(-1);
  const count = data.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && height > 0 && count > 0 && plotW > 0 && plotH > 0;

  const targets = data.map((d) => Number(d.target) || 0);
  const { max, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value), ...targets));

  const band = plotW / (count || 1);
  const barW = Math.min(MAX_BAR, band * 0.7);
  const cx = (i) => MARGIN.left + (i + 0.5) * band;
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;
  const baseY = MARGIN.top + plotH;
  const step = labelStep(count, plotW, 34);
  const lastIndex = count - 1;

  // Cifra del último día: sobre su columna; si la meta asoma justo por encima (choca), sobre la meta.
  const last = data[lastIndex];
  let lastLabelY = 0;
  if (last && last.value > 0) {
    lastLabelY = y(last.value) - 5;
    const targetTop = targets[lastIndex] > last.value ? y(targets[lastIndex]) : null;
    if (targetTop != null && targetTop > lastLabelY - LABEL_HEIGHT) lastLabelY = targetTop - 5;
    lastLabelY = Math.max(LABEL_HEIGHT - 3, lastLabelY);
  }

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
                {targets[i] > 0 ? <path d={topRounded(cx(i) - barW / 2, y(targets[i]), barW, baseY - y(targets[i]), 4)} fill={targetColor} /> : null}
                {d.value > 0 ? <path d={topRounded(cx(i) - barW / 2, y(d.value), barW, baseY - y(d.value), 4)} fill={color} /> : null}
                {i % step === 0 || i === lastIndex ? (
                  <text x={cx(i)} y={height - 6} textAnchor="middle" className="fill-subtle text-[11px]">
                    {d.label}
                  </text>
                ) : null}
              </g>
            ))}

            {last && last.value > 0 ? (
              <text x={cx(lastIndex)} y={lastLabelY} textAnchor="middle" className="fill-ink text-[11px] font-semibold tabular-nums">
                {compactNumber(last.value)}
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
