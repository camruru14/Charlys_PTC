import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { type } from "../../lib/typography";
import IconButton from "./IconButton";

// Encabezado de las pantallas del menú lateral (equivalente a PageHeader de
// la web). Se usa como opción `header` del Drawer.Navigator, así que recibe
// { navigation, options } de React Navigation:
//   - options.title        título grande (27/800)
//   - options.subtitle     subtítulo muted, opcional
//   - options.headerRight  acción de la derecha (ej. DateRangeButton o "+")
export default function ScreenHeader({ navigation, options }) {
  const insets = useSafeAreaInsets();
  const right = options.headerRight?.({ tintColor: colors.primary });

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <IconButton icon="menu" onPress={() => navigation.openDrawer()} accessibilityLabel="Abrir menú" />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <Text style={type.screenTitle} accessibilityRole="header" numberOfLines={1}>
        {options.title}
      </Text>
      {options.subtitle ? (
        <Text style={[type.subtitle, styles.subtitle]} numberOfLines={2}>
          {options.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  right: {
    flexShrink: 1,
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subtitle: {
    marginTop: 2,
  },
});
