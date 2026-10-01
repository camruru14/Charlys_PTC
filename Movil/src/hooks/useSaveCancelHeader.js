import { useLayoutEffect } from "react";
import { Pressable, Text } from "react-native";
import Button from "../components/ui/Button";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";

// Header estándar de las pantallas de formulario (LoteFabricacionFormScreen,
// TransaccionFormScreen, etc.): título + "Cancelar" a la izquierda +
// "Guardar" a la derecha, para no repetir el mismo `navigation.setOptions`
// en cada una. DetailHeader los muestra en su fila superior. Las pantallas
// se registran con `presentation: "modal"` en RootNavigator, así que
// "Cancelar" solo necesita volver atrás sin guardar nada.
// Pendiente: en cada módulo, "Guardar" pasa a una BottomBar.
export function useSaveCancelHeader({ navigation, title, saving, onSave, canSave = true }) {
  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={saving}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 15,
              color: saving ? colors.faint : colors.primary,
            }}
          >
            Cancelar
          </Text>
        </Pressable>
      ),
      headerRight: () => (
        <Button
          title={saving ? "Guardando…" : "Guardar"}
          size="small"
          onPress={onSave}
          disabled={saving || !canSave}
        />
      ),
    });
  }, [navigation, title, saving, onSave, canSave]);
}

export default useSaveCancelHeader;
