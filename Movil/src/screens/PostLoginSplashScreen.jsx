import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../lib/theme";

// Tiempo que se mantiene visible antes de pasar sola al Drawer.
const VISIBLE_MS = 1500;

// Se intercala entre LoginScreen y el Drawer justo después de un login
// exitoso (ver justLoggedIn en AuthContext / RootNavigator) — no aparece al
// reabrir la app con una sesión ya guardada, eso lo cubre el splash nativo
// de App.js. Reusa la misma imagen y fondo que ese splash nativo
// (assets/splash-icon.png, backgroundColor #ffffff, ver el plugin
// expo-splash-screen en app.json) para que se sienta como una continuación
// de él, con el nombre del empleado que acaba de iniciar sesión debajo.
export default function PostLoginSplashScreen() {
  const { user, clearJustLoggedIn } = useAuth();

  useEffect(() => {
    const timer = setTimeout(clearJustLoggedIn, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [clearJustLoggedIn]);

  const name = [user?.name, user?.lastName].filter(Boolean).join(" ");

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image source={require("../../assets/splash-icon.png")} style={styles.image} resizeMode="contain" />
      <Text style={styles.welcome}>Bienvenido{name ? "," : ""}</Text>
      {name ? <Text style={styles.name}>{name}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    gap: 4,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  welcome: {
    fontSize: 16,
    color: colors.slate500,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand700,
  },
});
