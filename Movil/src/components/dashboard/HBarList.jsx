import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Lista de barras horizontales (un solo color), como HBarList.jsx de la web: etiqueta, la barra (SVG)
// y el número al final. La barra no lleva fondo: solo la barra de color, desde el inicio, de 12 px de
// alto y con el extremo derecho redondeado a 4 px. Las etiquetas (110 px) y los números (56 px) tienen
// ancho fijo, así que las barras de todas las listas empiezan y terminan alineadas. La fila mide 36 px,
// así que el área de toque es mayor que la barra.
//   rows       [{ key, label, value, display?, onPress? }]  (display: texto del número; onPress: toque de la fila)
//   color      color de las barras
//   max        valor que llena la barra completa (por omisión, el mayor de las filas)
const BAR_HEIGHT = 12;
const RADIUS = 4;

// Rectángulo con solo el extremo derecho redondeado.
function rightRounded(w, h, r) {
  const radius = Math.min(r, w, h / 2);
  return `M0,0 H${w - radius} Q${w},0 ${w},${radius} V${h - radius} Q${w},${h} ${w - radius},${h} H0 Z`;
}

function Bar({ ratio, color }) {
  const [width, setWidth] = useState(0);
  const w = Math.max(RADIUS, width * ratio);
  return (
    <View style={styles.bar} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {width > 0 && ratio > 0 ? (
        <Svg width={width} height={BAR_HEIGHT}>
          <Path d={rightRounded(w, BAR_HEIGHT, RADIUS)} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

export default function HBarList({ rows = [], color, max, accessibilityLabel }) {
  const top = max ?? Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <View accessible={!rows.some((r) => r.onPress)} accessibilityLabel={accessibilityLabel}>
      {rows.map((r) => {
        const content = (
          <>
            <Text style={styles.label} numberOfLines={1}>
              {r.label}
            </Text>
            <Bar ratio={(Number(r.value) || 0) / top} color={color} />
            <Text style={styles.value}>{r.display ?? r.value}</Text>
          </>
        );
        return r.onPress ? (
          <Pressable
            key={r.key}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.display ?? r.value}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {content}
          </Pressable>
        ) : (
          <View key={r.key} style={styles.row}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, height: 36 },
  pressed: { opacity: 0.6 },
  label: { width: 110, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  bar: { flex: 1, height: BAR_HEIGHT },
  value: { width: 56, textAlign: "right", fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
});
