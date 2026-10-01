import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors, tones } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";
import { formatCompactMoney, formatMoney } from "../../lib/format";

// «Últimos seis meses» de Finanzas (MonthlyChart.jsx de la web): dos barras
// por mes (ingresos chart1, gastos chart2) sobre una escala «redonda».
//   months   = [{ key, label, title, income, expense, current }] (lib/finance.js)
//   selected = key del mes resaltado (por defecto, el actual)
//   onSelect(key)
// Debajo, un recuadro con los números del mes resaltado.
const AREA_H = 132;
const AXIS_W = 40;
const TOP_PAD = 8;
const NICE_STEPS = [1, 2, 4, 5, 10];

const SERIES = [
  { key: "income", label: "Ingresos", color: colors.chart1 },
  { key: "expense", label: "Gastos", color: colors.chart2 },
];

// Tope «redondo» de la escala: 17,300 -> 20,000.
function niceTop(max) {
  if (!(max > 0)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = NICE_STEPS.find((s) => s * magnitude >= max);
  return step * magnitude;
}

// Barra con las esquinas de arriba redondeadas.
function barPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export default function BarChart({ months, selected, onSelect }) {
  const [width, setWidth] = useState(0);

  const max = Math.max(0, ...months.flatMap((m) => [m.income, m.expense]));
  const top = niceTop(max);
  const ticks = top ? [top, top / 2, 0] : [0];
  const yOf = (v) => TOP_PAD + (top ? AREA_H - (v / top) * AREA_H : AREA_H);
  const heightOf = (v) => (top && v > 0 ? Math.max((v / top) * AREA_H, 2) : 0);

  const selectedMonth = months.find((m) => m.key === selected) || months[months.length - 1];
  const plotW = Math.max(width - AXIS_W, 0);
  const colW = months.length ? plotW / months.length : 0;
  const barW = Math.min(16, colW * 0.3);
  const svgH = TOP_PAD + AREA_H;
  const net = selectedMonth ? selectedMonth.income - selectedMonth.expense : 0;

  return (
    <View>
      <View style={styles.header}>
        <Text style={type.cardTitle}>Últimos seis meses</Text>
        <View style={styles.legend}>
          {SERIES.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            <Svg width={width} height={svgH}>
              {months.map((m, i) =>
                m.key === selectedMonth?.key ? (
                  <Rect
                    key="sel"
                    x={AXIS_W + i * colW + 2}
                    y={0}
                    width={colW - 4}
                    height={svgH}
                    rx={8}
                    fill={colors.selectBg}
                  />
                ) : null,
              )}
              {ticks.map((t) => (
                <Line
                  key={`g${t}`}
                  x1={AXIS_W}
                  x2={width}
                  y1={yOf(t)}
                  y2={yOf(t)}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                />
              ))}
              {ticks.map((t) => (
                <SvgText
                  key={`t${t}`}
                  x={0}
                  y={yOf(t) + 4}
                  fontSize={10.5}
                  fontFamily={fonts.medium}
                  fill={colors.subtle}
                >
                  {formatCompactMoney(t)}
                </SvgText>
              ))}
              {months.map((m, i) => {
                const cx = AXIS_W + i * colW + colW / 2;
                return SERIES.map((s, j) => {
                  const h = heightOf(m[s.key]);
                  if (!h) return null;
                  const x = j === 0 ? cx - barW - 1.5 : cx + 1.5;
                  return <Path key={`${m.key}-${s.key}`} d={barPath(x, yOf(0) - h, barW, h, 3)} fill={s.color} />;
                });
              })}
            </Svg>

            {/* Etiquetas de mes y zonas tocables (toda la columna). */}
            <View style={[styles.labels, { paddingLeft: AXIS_W }]}>
              {months.map((m) => {
                const active = m.key === selectedMonth?.key;
                return (
                  <Text
                    key={m.key}
                    style={[styles.month, { width: colW }, (m.current || active) && styles.monthStrong]}
                  >
                    {m.label}
                  </Text>
                );
              })}
            </View>
            <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: AXIS_W }]}>
              {months.map((m) => (
                <Pressable
                  key={m.key}
                  style={{ width: colW }}
                  onPress={() => onSelect(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={m.title}
                  accessibilityState={{ selected: m.key === selectedMonth?.key }}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={{ height: svgH + 26 }} />
        )}
      </View>

      {selectedMonth ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{selectedMonth.title}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Ingresos <Text style={styles.summaryValue}>{formatMoney(selectedMonth.income, 0)}</Text>
            </Text>
            <Text style={styles.summaryText}>
              Gastos <Text style={styles.summaryValue}>{formatMoney(selectedMonth.expense, 0)}</Text>
            </Text>
            <Text style={[styles.summaryNet, { color: net < 0 ? tones.rose.text : tones.green.text }]}>
              {net < 0 ? "−" : "+"}
              {formatMoney(Math.abs(net), 0)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  legend: { flexDirection: "row", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted },
  labels: { flexDirection: "row", paddingTop: 6 },
  month: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 11.5, color: colors.subtle },
  monthStrong: { fontFamily: fonts.bold, color: colors.ink },
  hitRow: { flexDirection: "row" },
  summary: {
    marginTop: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
  },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 12, rowGap: 2 },
  summaryText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  summaryValue: { fontFamily: fonts.bold, color: colors.ink, fontVariant: ["tabular-nums"] },
  summaryNet: { fontFamily: fonts.bold, fontSize: 12.5, fontVariant: ["tabular-nums"] },
});
