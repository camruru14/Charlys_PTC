import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, compactNumber, labelStep, niceScale } from "./chartUtils";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Gráfica de columnas con react-native-svg (portada de ColumnChart.jsx de la web): un solo eje,
// cuadrícula suave, columnas de 24 px como máximo con las esquinas de arriba redondeadas a 4 px.
//   data          [{ key, label, value, target? }]
//   color         color de las columnas
//   targetLabel   texto de la meta: si TODOS los días tienen la misma meta se dibuja una línea
//                 punteada con «Meta 21k»; si varía, una raya corta sobre cada columna
//   selected / onSelect / tooltip   columna tocada y su globo (tocar la misma la quita)
// El último valor lleva su cifra encima.
const MARGIN = { left: 40, right: 8, top: 18, bottom: 22 };
const MAX_BAR = 24;

// Rectángulo con las dos esquinas de arriba redondeadas.
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
}

export default function ColumnChart({ data = [], color, targetLabel = "Meta", height = 170, selected = null, onSelect, tooltip, accessibilityLabel }) {
  const [width, setWidth] = useState(0);
  const count = data.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && count > 0 && plotW > 0;

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
  const hasSelection = selected != null && selected >= 0 && selected < count;

  const onPress = (e) => {
    const index = bandIndexAt(e.nativeEvent.locationX, MARGIN.left, plotW, count);
    onSelect?.(index < 0 || index === selected ? null : index);
  };

  return (
    <View style={{ height }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {ready ? (
        <Pressable onPress={onPress} style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <G key={t}>
                <Line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={colors.lineSoft} strokeWidth={1} />
                <SvgText x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
                  {compactNumber(t)}
                </SvgText>
              </G>
            ))}
            {hasSelection ? <Rect x={MARGIN.left + selected * band} y={MARGIN.top} width={band} height={plotH} fill={colors.surface2} /> : null}

            {data.map((d, i) => (
              <G key={d.key}>
                {d.value > 0 ? <Path d={topRounded(cx(i) - barW / 2, y(d.value), barW, MARGIN.top + plotH - y(d.value), 4)} fill={color} /> : null}
                {hasTargets && !sameTarget && targets[i] > 0 ? (
                  <Line x1={cx(i) - barW / 2 - 3} x2={cx(i) + barW / 2 + 3} y1={y(targets[i])} y2={y(targets[i])} stroke={colors.ink2} strokeWidth={2} strokeLinecap="round" />
                ) : null}
                {i % step === 0 || i === lastIndex ? (
                  <SvgText x={cx(i)} y={height - 6} textAnchor="middle" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            ))}

            {sameTarget ? (
              <G>
                <Line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(targets[0])} y2={y(targets[0])} stroke={colors.ink2} strokeWidth={1.5} strokeDasharray="5 4" />
                <SvgText x={MARGIN.left + 4} y={y(targets[0]) - 5} fontSize={11} fontFamily={fonts.semibold} fill={colors.ink2}>
                  {targetLabel} {compactNumber(targets[0])}
                </SvgText>
              </G>
            ) : null}

            {data[lastIndex] && data[lastIndex].value > 0 ? (
              <SvgText x={cx(lastIndex)} y={y(data[lastIndex].value) - 5} textAnchor="middle" fontSize={11} fontFamily={fonts.semibold} fill={colors.ink}>
                {compactNumber(data[lastIndex].value)}
              </SvgText>
            ) : null}
          </Svg>
        </Pressable>
      ) : null}
      {ready && hasSelection && tooltip ? <ChartTooltip x={cx(selected)} y={MARGIN.top} containerWidth={width} {...tooltip(selected)} /> : null}
    </View>
  );
}
