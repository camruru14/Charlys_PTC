import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Burbuja con la cantidad de novedades de un módulo o pestaña (menú lateral y
// Segmented): igual que CountBubble.jsx de la web, una píldora de 18 de alto
// con el número en blanco sobre el color de marca. No se muestra si el conteo
// es 0 y pasa a «99+» desde 100. Al aparecer o cambiar de número hace un pequeño
// «pop» (escala de 0.8 a 1 en 150 ms), salvo con «Reducir movimiento».
export default function CountBubble({ count, style }) {
  const n = Number(count) || 0;
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (n <= 0 || reduce) return;
    scale.setValue(0.8);
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [n, reduce, scale]);

  if (n <= 0) return null;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${n} ${n === 1 ? "novedad" : "novedades"}`}
      style={[styles.bubble, { transform: [{ scale }] }, style]}
    >
      <Text style={styles.text}>{n > 99 ? "99+" : n}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: colors.white, fontVariant: ["tabular-nums"] },
});
