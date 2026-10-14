import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// ¿El usuario pidió «Reducir movimiento» en el sistema? Las animaciones
// decorativas (pop de la burbuja, fundido de las marcas) se saltan.
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduce(Boolean(on)));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export default useReduceMotion;
