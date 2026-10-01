import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../hooks/useAuth";
import BrandMark from "../components/ui/BrandMark";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import PasswordField from "../components/ui/PasswordField";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";

// Pantalla de inicio de sesión del panel administrativo, versión móvil de
// Web/private/frontend/src/pages/Login.jsx (logo IC, «Industrias Charly»,
// «Panel administrativo» y la tarjeta con correo y contraseña). Autentica
// contra POST /auth/login (src/lib/api.js) vía AuthContext. La línea «Demo»
// de la web no se muestra: la app apunta a la base de producción.
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || submitting) return;
    setError("");
    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);
    // Si result.ok, AuthContext actualiza isAuthenticated y RootNavigator
    // cambia solo al DrawerNavigator.
    if (!result.ok) setError(result.message);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BrandMark size={48} />
          <Text style={styles.title}>Industrias Charly</Text>
          <Text style={type.subtitle}>Panel administrativo</Text>
        </View>

        <View style={styles.form}>
          <FormField
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="admin@industriascharly.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
            editable={!submitting}
            returnKeyType="next"
          />
          <PasswordField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoComplete="password"
            textContentType="password"
            editable={!submitting}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Icon name="alert" size={16} color={tones.rose.text} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title={submitting ? "Ingresando…" : "Iniciar sesión"}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!email || !password}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 },
  header: { alignItems: "center", gap: 6, marginBottom: 24 },
  title: { marginTop: 6, fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.3, color: colors.ink },
  form: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tones.rose.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: tones.rose.text },
});
