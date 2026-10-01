import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "../../lib/theme";

// Envuelve una tarjeta de lista y, cuando `moved` pasa a true (la tarjeta
// cambió de grupo), dibuja un borde azul que se desvanece en ~2 s. `gap` es
// el margen inferior de la tarjeta, para que el borde no lo cubra.
export default function MovedFlash({ moved, gap = 10, children }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!moved) return;
    opacity.setValue(1);
    Animated.timing(opacity, { toValue: 0, duration: 1900, useNativeDriver: true }).start();
  }, [moved, opacity]);

  return (
    <View>
      {children}
      <Animated.View pointerEvents="none" style={[styles.flash, { bottom: gap, opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
