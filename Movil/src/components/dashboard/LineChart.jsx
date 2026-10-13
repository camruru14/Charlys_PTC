import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import ChartTooltip from "./ChartTooltip";
import { bandIndexAt, labelStep, niceScale } from "./chartUtils";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Gráfica de líneas con react-native-svg (portada de LineChart.jsx de la web): un solo eje vertical
// (de 0 a un máximo redondo), cuadrícula suave, líneas de 2 px y textos en los colores de texto del
// tema. Se dibuja al ancho de su contenedor.
//   labels        texto del eje x, uno por punto
//   series        [{ key, label, color, values, fill? }]  (fill: relleno del 10 % bajo la línea)
//   partialLast   el último tramo (penúltimo -> último punto) va punteado: dato incompleto
//   formatAxis    formato de las marcas del eje y
//   selected / onSelect   casillero tocado (guía vertical y globo); tocar el mismo lo quita
//   tooltip       (index) => { title, rows } del globo
//   accessibilityLabel    resumen para lectores de pantalla
// Cada línea termina en un punto (radio 4, con anillo blanco). La leyenda va a la derecha del título de
// la tarjeta (ChartLegend); con `legend` (por omisión) la dibuja aquí, arriba a la derecha.
const MARGIN = { left: 44, right: 8, top: 8, bottom: 22 };

export default function LineChart({
  labels = [],
  series = [],
  partialLast = false,
  formatAxis = String,
  height = 190,
  selected = null,
  onSelect,
  tooltip,
  accessibilityLabel,
  legend = true,
}) {
  const [width, setWidth] = useState(0);
  const count = labels.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const ready = width > 0 && count > 0 && plotW > 0;

  const { max, ticks } = niceScale(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i) => MARGIN.left + ((i + 0.5) * plotW) / count;
  const y = (v) => MARGIN.top + plotH - (v / max) * plotH;
  const step = labelStep(count, plotW);
  const pointsOf = (s, from = 0, to = count - 1) => s.values.slice(from, to + 1).map((v, k) => `${x(from + k)},${y(v)}`);
  const hasSelection = selected != null && selected >= 0 && selected < count;

  const onPress = (e) => {
    const index = bandIndexAt(e.nativeEvent.locationX, MARGIN.left, plotW, count);
    onSelect?.(index < 0 || index === selected ? null : index);
  };

  return (
    <View>
      {legend && series.length >= 2 ? (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ height }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {ready ? (
          <Pressable onPress={onPress} style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
            <Svg width={width} height={height}>
              {ticks.map((t) => (
                <G key={t}>
                  <Line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={colors.lineSoft} strokeWidth={1} />
                  <SvgText x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
                    {formatAxis(t)}
                  </SvgText>
                </G>
              ))}
              {labels.map((label, i) =>
                i % step === 0 ? (
                  <SvgText key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fontFamily={fonts.regular} fill={colors.subtle}>
                    {label}
                  </SvgText>
                ) : null,
              )}

              {series.map((s) => {
                const solidTo = partialLast && count > 1 ? count - 2 : count - 1;
                return (
                  <G key={s.key}>
                    {s.fill && count > 1 ? (
                      <Polygon points={`${x(0)},${y(0)} ${pointsOf(s).join(" ")} ${x(count - 1)},${y(0)}`} fill={s.color} fillOpacity={0.1} />
                    ) : null}
                    {solidTo >= 1 ? (
                      <Polyline points={pointsOf(s, 0, solidTo).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    ) : null}
                    {partialLast && count > 1 ? (
                      <Polyline points={pointsOf(s, count - 2, count - 1).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 4" />
                    ) : null}
                    <Circle cx={x(count - 1)} cy={y(s.values[count - 1])} r={4} fill={s.color} stroke={colors.surface} strokeWidth={2} />
                  </G>
                );
              })}

              {hasSelection ? (
                <G>
                  <Line x1={x(selected)} x2={x(selected)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={colors.faint} strokeWidth={1} strokeDasharray="3 3" />
                  {series.map((s) => (
                    <Circle key={s.key} cx={x(selected)} cy={y(s.values[selected])} r={4} fill={s.color} stroke={colors.surface} strokeWidth={2} />
                  ))}
                </G>
              ) : null}
            </Svg>
          </Pressable>
        ) : null}
        {ready && hasSelection && tooltip ? <ChartTooltip x={x(selected)} y={MARGIN.top} containerWidth={width} {...tooltip(selected)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", justifyContent: "flex-end", gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink2 },
});
