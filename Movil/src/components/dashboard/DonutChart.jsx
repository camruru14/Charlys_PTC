import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Gráfico de dona, portado de Web/private/frontend/src/components/ui/DonutChart.jsx
// a react-native-svg. Recibe data = [{ label, value, color }]; en el centro,
// `centerLabel` (cifra) y `centerCaption` (texto chico debajo).
export default function DonutChart({ data = [], size = 148, thickness = 18, centerLabel, centerCaption }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${center} ${center})`}>
            <Circle cx={center} cy={center} r={radius} stroke={colors.lineSoft} strokeWidth={thickness} fill="none" />
            {data.map((d, i) => {
              const dash = (d.value / total) * circumference;
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
                  fill="none"
                />
              );
              offset += dash;
              return el;
            })}
          </G>
        </Svg>
        {centerLabel ? (
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerLabel}>{centerLabel}</Text>
            {centerCaption ? <Text style={styles.centerCaption}>{centerCaption}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.legendValue}>{Math.round((d.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 18 },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  centerCaption: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  legendValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});
