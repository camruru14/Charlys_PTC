import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

const LABEL_HEIGHT = 26;
const MAX_VISIBLE_COLUMNS = 12;

function barWidth(count) {
  if (count <= 2) return 40;
  if (count <= 4) return 32;
  if (count <= 8) return 24;
  return 18;
}

function minColumnWidth(count) {
  if (count <= 2) return 140;
  if (count <= 4) return 100;
  if (count <= 8) return 70;
  return 60;
}

// Gráfico de barras agrupadas, portado de
// Web/private/frontend/src/components/ui/BarChart.jsx.
// data = [{ label, values: [income, expense] }]
// series = [{ name, color }]
export default function BarChart({ data = [], series = [], height = 220, formatValue }) {
  const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("es-SV"));
  const barsAreaH = Math.max(60, height - LABEL_HEIGHT);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (data.length > MAX_VISIBLE_COLUMNS && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: false });
    }
  }, [data]);

  const max = Math.max(1, ...data.flatMap((d) => (d.values?.length ? d.values : [0])));
  const gridLines = [0.25, 0.5, 0.75, 1];
  const bw = barWidth(data.length);
  const colWidth = Math.max(minColumnWidth(data.length), bw * (series.length || 1) + 16);
  const contentWidth = Math.max(data.length * colWidth, 240);

  return (
    <View>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: contentWidth }}>
          <View style={[styles.barsArea, { height: barsAreaH }]}>
            {gridLines.map((g) => (
              <View key={g} style={[styles.gridLine, { bottom: g * barsAreaH }]} />
            ))}
            <View style={styles.columns}>
              {data.map((d, i) => (
                <View key={i} style={[styles.column, { width: colWidth }]}>
                  {d.values.map((v, j) => (
                    <View
                      key={j}
                      style={{
                        width: bw,
                        marginHorizontal: 3,
                        height: v > 0 ? Math.max((v / max) * barsAreaH, 3) : 0,
                        backgroundColor: series[j]?.color || colors.slate400,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.labelsRow, { height: LABEL_HEIGHT }]}>
            {data.map((d, i) => (
              <Text key={i} style={[styles.label, { width: colWidth }]} numberOfLines={1}>
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        {series.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barsArea: { position: "relative", justifyContent: "flex-end" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.slate200 },
  columns: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, flexDirection: "row", alignItems: "flex-end" },
  column: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end" },
  labelsRow: { flexDirection: "row" },
  label: { textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.slate400, paddingTop: 6 },
  legend: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: colors.slate700 },
});
