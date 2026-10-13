import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, compactNumber, labelStep, niceScale } from "./chartUtils";
import { TARGET_COLOR } from "../../lib/chartColors";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Gráfica de columnas con react-native-svg (como ColumnChart.jsx de la web): un solo eje, cuadrícula
// suave, columnas de 24 px como máximo con las esquinas de arriba redondeadas a 4 px.
//   data          [{ key, label, value, target? }]
//   color         color de las columnas
//   targetColor   color de la meta: una columna gris clara del mismo ancho DETRÁS de la producida (si un
//                 día se pasó de la meta, la de color sobresale)
//   selected / onSelect / tooltip   columna tocada y su globo (tocar la misma la quita)
// Solo el último valor lleva su cifra encima; si choca con la parte de arriba de la meta, se sube. La
// leyenda («Producido» / «Meta») va a la derecha del título de la tarjeta (ChartLegend).
const MARGIN = { left: 40, right: 8, top: 18, bottom: 22 };
const MAX_BAR = 24;
const LABEL_HEIGHT = 14;

// Rectángulo con las dos esquinas de arriba redondeadas.
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
}

export default function ColumnChart({ data = [], color, targetColor = TARGET_COLOR, height = 170, selected = null, onSelect, tooltip, accessibilityLabel }) {
  const [width, setWidth] = useState(0);
  const count = data.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && count > 0 && plotW > 0;

  const targets = data.map((d) => Number(d.target) || 0);
  const { max, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value), ...targets));

  const band = plotW / (count || 1);
  const barW = Math.min(MAX_BAR, band * 0.7);
  const cx = (i) => MARGIN.left + (i + 0.5) * band;
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;
  const baseY = MARGIN.top + plotH;
  const step = labelStep(count, plotW, 34);
  const lastIndex = count - 1;
  const hasSelection = selected != null && selected >= 0 && selected < count;

  // Cifra del último día: sobre su columna; si la meta asoma justo por encima (choca), sobre la meta.
  const last = data[lastIndex];
  let lastLabelY = 0;
  if (last && last.value > 0) {
    lastLabelY = y(last.value) - 5;
    const targetTop = targets[lastIndex] > last.value ? y(targets[lastIndex]) : null;
    if (targetTop != null && targetTop > lastLabelY - LABEL_HEIGHT) lastLabelY = targetTop - 5;
    lastLabelY = Math.max(LABEL_HEIGHT - 3, lastLabelY);
  }

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
                {targets[i] > 0 ? <Path d={topRounded(cx(i) - barW / 2, y(targets[i]), barW, baseY - y(targets[i]), 4)} fill={targetColor} /> : null}
                {d.value > 0 ? <Path d={topRounded(cx(i) - barW / 2, y(d.value), barW, baseY - y(d.value), 4)} fill={color} /> : null}
                {i % step === 0 || i === lastIndex ? (
                  <SvgText x={cx(i)} y={height - 6} textAnchor="middle" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            ))}

            {last && last.value > 0 ? (
              <SvgText x={cx(lastIndex)} y={lastLabelY} textAnchor="middle" fontSize={11} fontFamily={fonts.semibold} fill={colors.ink}>
                {compactNumber(last.value)}
              </SvgText>
            ) : null}
          </Svg>
        </Pressable>
      ) : null}
      {ready && hasSelection && tooltip ? <ChartTooltip x={cx(selected)} y={MARGIN.top} containerWidth={width} {...tooltip(selected)} /> : null}
    </View>
  );
}
