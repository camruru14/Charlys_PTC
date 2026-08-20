import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

// Envoltorio de las pantallas de formulario (Fase 3 y 4): evita que el
// teclado tape el campo que se está llenando o el botón "Guardar" — mismo
// patrón que ya usaba LoginScreen.jsx desde la Fase 1, ahora reutilizado en
// vez de repetir KeyboardAvoidingView + ScrollView en cada formulario.
export default function KeyboardScreen({ style, contentContainerStyle, children }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
