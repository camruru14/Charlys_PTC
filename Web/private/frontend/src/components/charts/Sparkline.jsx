/*
  Mini gráfica de línea (sin ejes ni textos) para las tarjetas KPI. `data` es una lista de números;
  un null corta la línea (casillero sin dato). El último punto lleva un círculo. Una serie vacía o
  sin variación se dibuja como una línea plana.
*/
function Sparkline({ data = [], color, width = 90, height = 36, ariaLabel, className = "" }) {
  const pad = 3;
  const values = data.filter((v) => v != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;
  const x = (i) => (data.length <= 1 ? width / 2 : pad + (i * (width - pad * 2)) / (data.length - 1));
  const y = (v) => (max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2));

  // Tramos continuos (un null los separa).
  const runs = [];
  let run = [];
  data.forEach((v, i) => {
    if (v == null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push([x(i), y(v)]);
    }
  });
  if (run.length) runs.push(run);
  const last = [...runs].pop()?.at(-1);

  return (
    <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`shrink-0 ${className}`}>
      {runs.length === 0 ? <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke="var(--color-line)" strokeWidth={2} strokeLinecap="round" /> : null}
      {runs.map((points, k) =>
        points.length === 1 ? null : (
          <polyline key={k} points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
      {last ? <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} /> : null}
    </svg>
  );
}

export default Sparkline;
