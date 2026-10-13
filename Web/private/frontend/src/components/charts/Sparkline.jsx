/*
  Mini gráfica de línea (sin ejes ni textos) para las tarjetas KPI: línea de 2 px, relleno del mismo
  color al 10 % bajo la línea y un punto al final (radio 4, con anillo blanco de 2 px). `data` es una
  lista de números; un null corta la línea (casillero sin dato). Con menos de 2 puntos no dibuja
  nada, pero conserva su espacio para que la tarjeta no cambie de alto.
*/
function Sparkline({ data = [], color, width = 90, height = 36, ariaLabel, className = "" }) {
  const pad = 6; // deja lugar al punto final (radio 4 + anillo)
  const values = data.filter((v) => v != null);
  if (values.length < 2) return <span aria-hidden="true" className={`shrink-0 ${className}`} style={{ width, height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (width - pad * 2)) / (data.length - 1);
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
  const last = runs[runs.length - 1].at(-1);
  const base = height - 2;

  return (
    <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`shrink-0 ${className}`}>
      {runs.map((points, k) =>
        points.length < 2 ? null : (
          <g key={k}>
            <polygon points={`${points[0][0]},${base} ${points.map((p) => p.join(",")).join(" ")} ${points.at(-1)[0]},${base}`} fill={color} fillOpacity={0.1} />
            <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ),
      )}
      <circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}

export default Sparkline;
