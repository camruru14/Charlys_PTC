import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors } from "../../lib/theme";

// Marca de un registro con novedades (lo que en la web son UnseenDot y el
// fondo UNSEEN_BG): un punto azul de 8 a la izquierda y un velo azul muy
// suave sobre el fondo de la fila. Va como PRIMER hijo de la fila (el velo
// queda debajo del contenido), que debe tener el mismo radio que se pase en
// `radius`. Siempre montada: al marcarse vista se desvanece en 150 ms, salvo
// con «Reducir movimiento».
//   <Pressable> <UnseenMark show={unseen} radius={16} /> …contenido… </Pressable>
// `dotTop` coloca el punto a la altura del texto principal; `tint={false}` deja el
// fondo de la fila como está (p. ej. bajo mínimo en Inventario) y solo pone el punto.
export default function UnseenMark({ show, radius = 0, dotTop = 19, dotLeft = 5, tint = true }) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(show ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      opacity.setValue(show ? 1 : 0);
      return;
    }
    Animated.timing(opacity, { toValue: show ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [show, reduce, opacity]);

  return (
    <>
      {tint ? <Animated.View pointerEvents="none" style={[styles.tint, { borderRadius: radius, opacity }]} /> : null}
      <Animated.View
        pointerEvents="none"
        accessible={show}
        accessibilityLabel={show ? "Nuevo" : undefined}
        style={[styles.dot, { top: dotTop, left: dotLeft, opacity }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primarySoft },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
