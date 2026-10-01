import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Button from "./Button";
import { useToastBottomInset } from "./Toast";

// Barra fija al pie de una pantalla (guardar/cancelar, confirmar pedido).
// `actions` es un arreglo de 1 o 2 props de <Button /> — el primero va a la
// izquierda, así que el secundario se pone primero:
//   <BottomBar note="3 productos · $ 1.240"
//     actions={[{ title: "Cancelar", variant: "secondary", onPress: back },
//               { title: "Guardar", onPress: save, loading: saving }]} />
// Se coloca como último hijo de la pantalla (fuera del ScrollView).
export default function BottomBar({ actions = [], note, style }) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  // Solo la barra de la pantalla visible cuenta: el stack deja montadas las
  // anteriores y el toast no debe subir por una que no se ve.
  const focused = useIsFocused();
  useToastBottomInset(focused ? height : 0);

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom + 12 }, style]}
      onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.actions}>
        {actions.slice(0, 2).map((action, index) => (
          <Button key={action.title ?? action.label ?? index} {...action} style={[styles.button, action.style]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
