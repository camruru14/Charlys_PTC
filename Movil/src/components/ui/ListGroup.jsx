import { Children, Fragment, isValidElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Tarjeta blanca con filas separadas por líneas `lineSoft`, para listas tipo
// tabla (detalle de un pedido, datos de la empresa...). Los hijos nulos o
// `false` se ignoran, así que se puede usar con condiciones.
//   <ListGroup>
//     <ListRow title="Cliente" value="Plásticos del Norte" />
//     <ListRow title="Bodega" value="Central" onPress={...} />
//   </ListGroup>
export default function ListGroup({ children, style }) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.group, style]}>
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// Fila estándar: título (y subtítulo) a la izquierda, `value` o `right` a la
// derecha. Con `onPress` se vuelve tocable y muestra un chevron.
// `subtitleLines` (2 por defecto) es el máximo de líneas del subtítulo.
export function ListRow({ title, subtitle, subtitleLines = 2, value, left, right, onPress, style }) {
  const content = (
    <>
      {left}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value != null ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress ? <Icon name="chevronRight" size={18} color={colors.chevron} /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginHorizontal: 15,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  pressed: {
    backgroundColor: colors.surface2,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
  },
  value: {
    maxWidth: "55%",
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
