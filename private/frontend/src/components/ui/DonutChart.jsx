/*
  Gráfico de dona (donut chart) construido con SVG puro, sin librerías.
  Recibe: data = [{ label, value, color }]
*/

function DonutChart({ data = [], size = 168, thickness = 22, centerLabel }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={thickness}
          />
          {data.map((d, i) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            // Con value 0, un trazo de largo 0 + strokeLinecap="round" dibuja un punto fantasma; se omite.
            if (dash <= 0) return null;
            const circle = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return circle;
          })}
        </g>
        {centerLabel ? (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-900"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>

      <ul className="w-full space-y-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.label}
            </span>
            <span className="font-semibold text-slate-900">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
