import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NAV_ITEMS } from "../../navigation/navItems";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";
import Pill from "./Pill";

// Nombre de la pantalla a la que vuelve el "‹": si es el menú lateral
// ("App"), la sección del drawer que estaba abierta; si no, el título que
// React Navigation ya calculó (`back.title`).
function previousLabel(navigation, route, back) {
  const state = navigation.getState();
  const index = state.routes.findIndex((r) => r.key === route.key);
  const prev = index > 0 ? state.routes[index - 1] : null;
  if (prev?.name === "App") {
    const drawer = prev.state;
    const drawerRoute = drawer?.routes?.[drawer.index ?? 0]?.name || "Dashboard";
    return NAV_ITEMS[drawerRoute]?.label || "Volver";
  }
  return back?.title || "Volver";
}

// Encabezado de las pantallas de detalle y formularios del Stack
// (RootNavigator). Se usa como opción `header`, así que recibe
// { navigation, route, options, back } de React Navigation:
//   - options.title            título (23/800)
//   - options.headerStatus     { label, tone } -> Pill al lado del título
//   - options.headerSubtitle   subtítulo, opcional
//   - options.headerRight      acción de la derecha
//   - options.headerBackTitle  texto del «‹» (si no, el de la pantalla anterior)
//   - options.headerLeft       reemplaza al "‹ Anterior" (opcional)
export default function DetailHeader({ navigation, route, options, back }) {
  const insets = useSafeAreaInsets();
  // En iOS los modales son una hoja que ya queda debajo de la barra de estado.
  const isIosModal = Platform.OS === "ios" && options.presentation === "modal";
  const left = options.headerLeft?.({ tintColor: colors.primary, canGoBack: Boolean(back) });
  // options.headerBackTitle (opcional) reemplaza el nombre calculado, p. ej.
  // la pestaña de la que se vino («‹ Lotes»).
  const backLabel = options.headerBackTitle || previousLabel(navigation, route, back);
  const right = options.headerRight?.({ tintColor: colors.primary, canGoBack: Boolean(back) });
  const status = options.headerStatus;

  return (
    <View style={[styles.header, { paddingTop: isIosModal ? 14 : insets.top + 8 }]}>
      <View style={styles.topRow}>
        {left ??
          (back || navigation.canGoBack() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Volver a ${backLabel}`}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Icon name="back" size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.backText} numberOfLines={1}>
                {backLabel}
              </Text>
            </Pressable>
          ) : (
            <View />
          ))}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {options.title ?? route.name}
        </Text>
        {status?.label ? <Pill label={status.label} tone={status.tone} style={styles.pill} /> : null}
      </View>
      {options.headerSubtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {options.headerSubtitle}
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
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  back: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: -4,
  },
  pressed: {
    opacity: 0.6,
  },
  backText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.primary,
  },
  right: {
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 4,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.extrabold,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  pill: {
    alignSelf: "center",
  },
  subtitle: {
    marginTop: 3,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
});
