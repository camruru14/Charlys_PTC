import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Toast con botón «Deshacer», equivalente a toastUndo.jsx de la web (6 s).
//   const toast = useToast();
//   toast.undo("Línea empacada", () => api.del(...));
//   toast.show("Guardado");
// Al presionar «Deshacer» se cierra el toast y se llama onUndo. Se muestra
// uno a la vez: uno nuevo reemplaza al anterior.
const DURATION = 6000;

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message, { onUndo, duration = DURATION } = {}) => {
      clearTimeout(timer.current);
      setToast({ id: Date.now(), message, onUndo });
      timer.current = setTimeout(hide, duration);
    },
    [hide]
  );

  const undo = useCallback((message, onUndo) => show(message, { onUndo }), [show]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show, undo, hide }), [show, undo, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHide={hide} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

function ToastView({ toast, onHide }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 16, opacity: progress, transform: [{ translateY }] }]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Icon name="check" size={18} color={tones.green.dot} strokeWidth={2.2} />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.onUndo ? (
          <Pressable
            onPress={() => {
              onHide();
              toast.onUndo();
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.undo, pressed && styles.undoPressed]}
          >
            <Text style={styles.undoText}>Deshacer</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  toast: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.white,
  },
  undo: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  undoPressed: {
    backgroundColor: colors.ink2,
  },
  undoText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryDisabled,
  },
});
