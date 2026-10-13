import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Dona con react-native-svg (portada de Donut.jsx de la web): segmentos separados 2 px entre sí, con
// el total al centro.
//   data            [{ key, label, value, color }]  (los de valor 0 no se dibujan)
//   size            diámetro en píxeles (112 por omisión)
//   thickness       grosor del anillo
//   centerLabel / centerCaption   texto grande y texto chico del centro
const GAP_PX = 2;

function polar(c, r, angle) {
  return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
}

function arcPath(c, r, a0, a1) {
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

export default function Donut({ data = [], size = 112, thickness = 16, centerLabel, centerCaption, accessibilityLabel }) {
  const segments = data.filter((d) => d.value > 0);
  const total = segments.reduce((s, d) => s + d.value, 0);
  const c = size / 2;
  const r = (size - thickness) / 2 - 1;
  const gap = segments.length > 1 ? GAP_PX / r : 0;

  const arcs = segments.map((d, i) => {
    const before = segments.slice(0, i).reduce((s, x) => s + x.value, 0);
    const start = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const sweep = (d.value / total) * Math.PI * 2;
    return { ...d, a0: start + gap / 2, a1: start + sweep - gap / 2 };
  });

  return (
    <Svg width={size} height={size} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.lineSoft} strokeWidth={thickness} />
      {arcs.length === 1 ? (
        <Circle cx={c} cy={c} r={r} fill="none" stroke={arcs[0].color} strokeWidth={thickness} />
      ) : (
        arcs.map((a) => <Path key={a.key} d={arcPath(c, r, a.a0, a.a1)} fill="none" stroke={a.color} strokeWidth={thickness} />)
      )}
      {centerLabel != null ? (
        <SvgText x={c} y={centerCaption ? c : c + 5} textAnchor="middle" fontSize={15} fontFamily={fonts.bold} fill={colors.ink}>
          {centerLabel}
        </SvgText>
      ) : null}
      {centerCaption ? (
        <SvgText x={c} y={c + 15} textAnchor="middle" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
          {centerCaption}
        </SvgText>
      ) : null}
    </Svg>
  );
}
