import { useCallback, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
// Un import por peso: el índice de @expo-google-fonts/figtree incluiría en el
// bundle los 14 archivos de la familia (itálicas, 300, 900).
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { Figtree_800ExtraBold } from "@expo-google-fonts/figtree/800ExtraBold";
import { AuthProvider } from "./src/context/AuthContext";
import { DateRangeProvider } from "./src/context/DateRangeContext";
import { useAuth } from "./src/hooks/useAuth";
import RootNavigator from "./src/navigation/RootNavigator";
import { ToastProvider } from "./src/components/ui/Toast";
import { colors } from "./src/lib/theme";

// Mantiene visible la splash screen nativa hasta que carguen las fuentes y
// AuthContext termine de leer la sesión guardada en SecureStore (ver Gate).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Espera a las fuentes y a que AuthContext resuelva `loading` antes de
// mostrar la navegación: evita un parpadeo hacia Login cuando en realidad ya
// hay una sesión guardada, y que el texto aparezca primero con la fuente del
// sistema.
function Gate({ fontsReady }) {
  const { loading } = useAuth();
  const ready = fontsReady && !loading;

  const onLayout = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loading} onLayout={onLayout}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  // Si las fuentes fallan se sigue igual, con la fuente del sistema.
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ToastProvider>
          <DateRangeProvider>
            <AuthProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <Gate fontsReady={fontsReady} />
              </NavigationContainer>
            </AuthProvider>
          </DateRangeProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
});
