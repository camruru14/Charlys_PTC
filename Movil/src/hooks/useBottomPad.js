import { useSafeAreaInsets } from "react-native-safe-area-context";

// Padding inferior del contenido de una pantalla sin BottomBar: el que ya
// tenía (`base`) más el área segura de abajo (barra de gestos o de
// navegación de Android, que con edge-to-edge queda encima de la app). Las
// pantallas con BottomBar no lo necesitan: la barra ya suma ese inset.
//   contentContainerStyle={[styles.content, bottomPad]}
export function useBottomPad(base = 32) {
  const insets = useSafeAreaInsets();
  return { paddingBottom: base + insets.bottom };
}

export default useBottomPad;
