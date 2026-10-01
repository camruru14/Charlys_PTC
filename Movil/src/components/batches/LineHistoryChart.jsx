import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatNumber, formatShortDate } from "../../lib/format";
import { batchEnd, batchStart } from "../../lib/batchFlow";

const CHART_HEIGHT = 120;
// Alto útil de las barras (deja espacio arriba para el valor).
const BAR_AREA = CHART_HEIGHT - 18;
const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();

// Últimos lotes completados de la línea, con la meta del lote actual como
// línea punteada (LineChart de BatchDetail.jsx en la web).
export default function LineHistoryChart({ batch, history }) {
  if (!history.length) {
    return <Text style={styles.empty}>Sin lotes completados en esta línea.</Text>;
  }
  const target = batch.targetQuantity || 0;
  const scale = Math.max(target, ...history.map((b) => b.producedQuantity || 0), 1);

  return (
    <View>
      <View style={[styles.plot, { height: CHART_HEIGHT }]}>
        {target > 0 ? (
          <View style={[styles.meta, { bottom: (target / scale) * BAR_AREA }]} pointerEvents="none">
            <Text style={styles.metaLabel}>Meta</Text>
          </View>
        ) : null}
        {history.map((b) => {
          const current = b._id === batch._id;
          const value = b.producedQuantity || 0;
          return (
            <View key={b._id} style={styles.column}>
              <Text style={[styles.value, current && styles.current]}>{formatNumber(value)}</Text>
              <View
                style={[
                  styles.bar,
                  { height: (value / scale) * BAR_AREA, backgroundColor: current ? colors.chart1 : colors.chartHistory },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {history.map((b) => {
          const current = b._id === batch._id;
          const end = batchEnd(b)?.date || batchStart(b)?.date;
          return (
            <Text key={b._id} style={[styles.label, current && styles.current]} numberOfLines={1}>
              {current && isToday(end) ? "Hoy" : formatShortDate(end)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 8 },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  meta: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.chartRef,
    zIndex: 1,
  },
  metaLabel: {
    position: "absolute",
    right: 0,
    top: -14,
    paddingLeft: 4,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: colors.subtle,
  },
  column: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" },
  value: { marginBottom: 3, fontFamily: fonts.regular, fontSize: 10, color: colors.subtle, fontVariant: ["tabular-nums"] },
  bar: { width: "100%", maxWidth: 36, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: "row", gap: 8, marginTop: 5 },
  label: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.subtle,
    fontVariant: ["tabular-nums"],
  },
  current: { fontFamily: fonts.bold, color: colors.ink },
});
