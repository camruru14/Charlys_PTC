import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../hooks/useAuth";
import BrandMark from "../components/ui/BrandMark";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";

// Tiempo que se mantiene visible antes de pasar sola al Drawer.
const VISIBLE_MS = 1500;

// Se intercala entre LoginScreen y el Drawer justo después de un login
// exitoso (ver justLoggedIn en AuthContext / RootNavigator) — no aparece al
// reabrir la app con una sesión ya guardada, eso lo cubre el splash nativo
// de App.js. Logo IC, «Bienvenido,» y el nombre del empleado, sobre canvas.
export default function PostLoginSplashScreen() {
  const { user, clearJustLoggedIn } = useAuth();

  useEffect(() => {
    const timer = setTimeout(clearJustLoggedIn, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [clearJustLoggedIn]);

  const name = [user?.name, user?.lastName].filter(Boolean).join(" ");

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <StatusBar style="dark" />
      <BrandMark size={64} style={styles.logo} />
      <Text style={styles.welcome}>Bienvenido{name ? "," : ""}</Text>
      {name ? (
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    paddingHorizontal: 32,
    gap: 4,
  },
  logo: { marginBottom: 20 },
  welcome: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  name: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.3, color: colors.ink, textAlign: "center" },
});
