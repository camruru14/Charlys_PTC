import { useState } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, labelStep, niceScale } from "./chartUtils";

/*
  Gráfica de líneas con SVG propio. Un solo eje vertical (de 0 a un máximo redondo), cuadrícula de
  1 px muy suave, líneas de 2 px y textos en los colores de texto del sistema. Se dibuja a tamaño
  real (mide su contenedor) y ocupa todo el alto disponible.
    labels        texto del eje x, uno por punto
    series        [{ key, label, color, values, fill? }]  (fill: relleno del 10 % bajo la línea)
    partialLast   el último tramo (penúltimo -> último punto) va punteado: dato incompleto
    formatAxis    formato de las marcas del eje y (p. ej. fmtCompactMoney)
    renderTooltip (index) => nodo del globo al pasar el mouse; la guía vertical y los puntos salen solos
    ariaLabel     resumen para lectores de pantalla
  Con 2 series o más muestra la leyenda. El área de toque es todo el casillero de cada punto.
*/
const MARGIN = { left: 46, right: 12, top: 8, bottom: 22 };

function LineChart({ labels = [], series = [], partialLast = false, formatAxis = String, renderTooltip, ariaLabel, className = "" }) {
  const [ref, { width, height }] = useElementSize();
  const [hover, setHover] = useState(-1);
  const count = labels.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && height > 0 && count > 0 && plotW > 0 && plotH > 0;

  const { max, ticks } = niceScale(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i) => MARGIN.left + ((i + 0.5) * plotW) / count;
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;
  const step = labelStep(count, plotW);

  const pointsOf = (s, from = 0, to = count - 1) => s.values.slice(from, to + 1).map((v, k) => `${x(from + k)},${y(v)}`);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {series.length >= 2 ? (
        <ul className="mb-1.5 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={ref} className="relative min-h-0 flex-1">
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
                    {formatAxis(t)}
                  </text>
                </g>
              ))}
              {labels.map((label, i) =>
                i % step === 0 ? (
                  <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-subtle text-[11px]">
                    {label}
                  </text>
                ) : null,
              )}

              {series.map((s) => {
                const solidTo = partialLast && count > 1 ? count - 2 : count - 1;
                return (
                  <g key={s.key}>
                    {s.fill && count > 1 ? (
                      <polygon points={`${x(0)},${y(0)} ${pointsOf(s).join(" ")} ${x(count - 1)},${y(0)}`} fill={s.color} fillOpacity={0.1} />
                    ) : null}
                    {solidTo >= 1 ? <polyline points={pointsOf(s, 0, solidTo).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
                    {partialLast && count > 1 ? (
                      <polyline points={pointsOf(s, count - 2, count - 1).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 4" />
                    ) : null}
                    {count === 1 ? <circle cx={x(0)} cy={y(s.values[0])} r={3} fill={s.color} /> : null}
                  </g>
                );
              })}

              {hover >= 0 ? (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--color-faint)" strokeWidth={1} strokeDasharray="3 3" />
                  {series.map((s) => (
                    <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                  ))}
                </g>
              ) : null}
              <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="transparent" />
            </svg>
            {hover >= 0 && renderTooltip ? (
              <ChartTooltip x={x(hover)} y={MARGIN.top} containerWidth={width}>
                {renderTooltip(hover)}
              </ChartTooltip>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default LineChart;
