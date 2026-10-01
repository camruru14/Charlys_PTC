/*
  Gráfico de dona (donut chart) construido con SVG puro, sin librerías.
  Recibe: data = [{ label, value, color }] (color: CHART_COLORS de lib/tones.js)
*/

function DonutChart({ data = [], size = 168, thickness = 22, centerLabel, centerCaption }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Largo de cada arco y su desplazamiento acumulado, calculados antes de pintar.
  const arcs = data.reduce((acc, d) => {
    const dash = (d.value / total) * circumference;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ ...d, dash, offset });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-chart-grid)"
            strokeWidth={thickness}
          />
          {arcs.map((a, i) =>
            // Con value 0, un trazo de largo 0 + strokeLinecap="round" dibuja un punto fantasma; se omite.
            a.dash <= 0 ? null : (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={a.color}
                strokeWidth={thickness}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={-a.offset}
                strokeLinecap="round"
              />
            ),
          )}
        </g>
        {centerLabel ? (
          <text
            x="50%"
            y={centerCaption ? size / 2 - 7 : "50%"}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-ink"
            style={{ fontSize: 22, fontWeight: 600 }}
          >
            {centerLabel}
          </text>
        ) : null}
        {centerLabel && centerCaption ? (
          <text
            x="50%"
            y={size / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-subtle"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {centerCaption}
          </text>
        ) : null}
      </svg>

      <ul className="w-full space-y-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 text-ink-2">
              <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: d.color }} />
              {d.label}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
