import { useCallback, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import { DateRangeProvider } from "./src/context/DateRangeContext";
import { useAuth } from "./src/hooks/useAuth";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/lib/theme";

// Mantiene visible la splash screen nativa hasta que AuthContext termine de
// leer la sesión guardada en SecureStore (ver Gate más abajo).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Espera a que AuthContext resuelva `loading` antes de mostrar la
// navegación: evita un parpadeo hacia Login cuando en realidad ya hay una
// sesión guardada en el dispositivo.
function Gate() {
  const { loading } = useAuth();

  const onLayout = useCallback(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.loading} onLayout={onLayout}>
        <ActivityIndicator size="large" color={colors.brand600} />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <DateRangeProvider>
          <AuthProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <Gate />
            </NavigationContainer>
          </AuthProvider>
        </DateRangeProvider>
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
    backgroundColor: colors.background,
  },
});
