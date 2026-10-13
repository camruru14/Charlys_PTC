import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { colors } from "../../lib/theme";

// Mini gráfica de línea (sin ejes ni textos) para las tarjetas KPI; ocupa el ancho que se le dé.
// `data` es una lista de números; un null corta la línea (casillero sin dato). El último punto lleva
// un círculo. Una serie vacía o sin variación se dibuja como una línea plana.
export default function Sparkline({ data = [], color, width = 120, height = 34, accessibilityLabel }) {
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
  const lastRun = runs[runs.length - 1];
  const last = lastRun ? lastRun[lastRun.length - 1] : null;

  return (
    <Svg width={width} height={height} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {runs.length === 0 ? (
        <Line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke={colors.line} strokeWidth={2} strokeLinecap="round" />
      ) : null}
      {runs.map((points, k) =>
        points.length === 1 ? null : (
          <Polyline
            key={k}
            points={points.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      {last ? <Circle cx={last[0]} cy={last[1]} r={2.5} fill={color} /> : null}
    </Svg>
  );
}
