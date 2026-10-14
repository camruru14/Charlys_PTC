import { useState } from "react";
import ChartTooltip from "./ChartTooltip";

/*
  Dona con SVG propio: segmentos separados 2 px entre sí, con el total al centro.
    data            [{ key, label, value, color }]  (los de valor 0 no se dibujan)
    size            diámetro en píxeles
    thickness       grosor del anillo
    centerLabel / centerCaption   texto grande y texto chico del centro (p. ej. «$8,420» y «31 pedidos»)
    activeKey / onActiveChange    segmento resaltado desde afuera (la lista que acompaña a la dona)
    renderTooltip   (segmento) => nodo del globo al pasar el mouse sobre un segmento
    ariaLabel       resumen para lectores de pantalla
  El área de toque de cada segmento es más ancha que el anillo.
*/
const GAP_PX = 2;
const MIN_ARC_PX = 2; // arco mínimo visible de un segmento

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

function Donut({ data = [], size = 140, thickness = 20, centerLabel, centerCaption, activeKey, onActiveChange, renderTooltip, ariaLabel, className = "" }) {
  const [localActive, setLocalActive] = useState(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const active = activeKey !== undefined ? activeKey : localActive;
  const setActive = (key) => {
    setLocalActive(key);
    onActiveChange?.(key);
  };

  const segments = data.filter((d) => d.value > 0);
  const total = segments.reduce((s, d) => s + d.value, 0);
  const c = size / 2;
  const r = (size - thickness) / 2 - 2;
  const gap = segments.length > 1 ? GAP_PX / r : 0;

  const arcs = segments.map((d, i) => {
    const before = segments.slice(0, i).reduce((s, x) => s + x.value, 0);
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const sweep = (d.value / total) * Math.PI * 2;
    // El hueco entre segmentos solo se aplica si el segmento es más grande que el hueco: con un valor
    // diminuto (≈0.5 % del total) restarlo dejaba a1 < a0 y el arco se dibujaba fuera del anillo.
    // Además, todo segmento mide al menos MIN_ARC_PX de arco para que se vea.
    const inset = sweep > gap * 2 ? gap / 2 : 0;
    const span = Math.max(sweep - inset * 2, MIN_ARC_PX / r);
    return { ...d, a0: start + inset, a1: start + inset + span };
  });
  const shown = segments.find((d) => d.key === active);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
      }}
    >
      <svg role="img" aria-label={ariaLabel} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth={thickness} />
        {arcs.map((a) => {
          const isActive = a.key === active;
          const full = arcs.length === 1;
          return (
            <g key={a.key} onPointerEnter={() => setActive(a.key)} onPointerLeave={() => setActive(null)}>
              {full ? (
                <circle cx={c} cy={c} r={r} fill="none" stroke={a.color} strokeWidth={isActive ? thickness + 3 : thickness} />
              ) : (
                <path d={arcPath(c, c, r, a.a0, a.a1)} fill="none" stroke={a.color} strokeWidth={isActive ? thickness + 3 : thickness} opacity={active && !isActive ? 0.45 : 1} />
              )}
              {full ? (
                <circle cx={c} cy={c} r={r} fill="none" stroke="transparent" strokeWidth={thickness + 14} />
              ) : (
                <path d={arcPath(c, c, r, a.a0, a.a1)} fill="none" stroke="transparent" strokeWidth={thickness + 14} />
              )}
            </g>
          );
        })}
        {centerLabel != null ? (
          <text x={c} y={centerCaption ? c - 2 : c} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-[15px] font-bold tabular-nums">
            {centerLabel}
          </text>
        ) : null}
        {centerCaption ? (
          <text x={c} y={c + 14} textAnchor="middle" dominantBaseline="middle" className="fill-subtle text-[11px]">
            {centerCaption}
          </text>
        ) : null}
      </svg>
      {shown && renderTooltip ? (
        <ChartTooltip x={pointer.x} y={pointer.y} containerWidth={size}>
          {renderTooltip(shown)}
        </ChartTooltip>
      ) : null}
    </div>
  );
}

export default Donut;
