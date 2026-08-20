import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { colors } from "../../lib/theme";

// Gráfico de dona (donut chart), portado de
// Web/private/frontend/src/components/ui/DonutChart.jsx a react-native-svg.
// Recibe data = [{ label, value, color }].
export default function DonutChart({ data = [], size = 168, thickness = 22, centerLabel }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle cx={center} cy={center} r={radius} stroke="#eef2f7" strokeWidth={thickness} fill="none" />
          {data.map((d, i) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            if (dash <= 0) return null;
            const el = (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                fill="none"
              />
            );
            offset += dash;
            return el;
          })}
        </G>
        {centerLabel ? (
          <SvgText
            x={center}
            y={center}
            fill={colors.text}
            fontSize={22}
            fontWeight="700"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>

      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
            <Text style={styles.legendValue}>{Math.round((d.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 16 },
  legend: { width: "100%", gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, color: colors.slate700, flexShrink: 1 },
  legendValue: { fontSize: 13, fontWeight: "700", color: colors.text },
});
