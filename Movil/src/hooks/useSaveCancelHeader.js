import { useLayoutEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import { colors } from "../lib/theme";

// Header estándar de las 7 pantallas de formulario de la Fase 3
// (LoteFabricacionFormScreen, TransaccionFormScreen, etc.): título +
// "Cancelar" a la izquierda + "Guardar" a la derecha, para no repetir el
// mismo `navigation.setOptions` en cada una. Las pantallas se registran con
// `presentation: "modal"` en RootNavigator, así que "Cancelar" solo necesita
// volver atrás sin guardar nada.
export function useSaveCancelHeader({ navigation, title, saving, onSave, canSave = true }) {
  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={saving} hitSlop={10}>
          <Text style={{ color: colors.brand700, fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={onSave} disabled={saving || !canSave} hitSlop={10}>
          <Text
            style={{
              color: saving || !canSave ? colors.slate400 : colors.brand700,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, title, saving, onSave, canSave]);
}

export default useSaveCancelHeader;
