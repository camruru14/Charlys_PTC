import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../hooks/useAuth";
import CustomButton from "../components/ui/CustomButton";
import { colors } from "../lib/theme";

// Pantalla de inicio de sesión del panel administrativo, versión móvil de
// Web/private/frontend/src/pages/Login.jsx. Autentica contra
// POST /auth/login (src/lib/api.js) vía AuthContext.
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
    }
    // Si result.ok, AuthContext actualiza isAuthenticated y RootNavigator
    // cambia solo al DrawerNavigator.
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>IC</Text>
          </View>
          <Text style={styles.title}>Industrias Charly</Text>
          <Text style={styles.subtitle}>Panel administrativo</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@industriascharly.com"
            placeholderTextColor={colors.slate400}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.slate400}
            secureTextEntry
            editable={!submitting}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <CustomButton
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
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    gap: 6,
  },
  logoBadge: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand700,
  },
  subtitle: {
    fontSize: 13,
    color: colors.slate500,
  },
  form: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: 20,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: colors.dangerSoftBg,
    borderRadius: 12,
    padding: 10,
    marginTop: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
