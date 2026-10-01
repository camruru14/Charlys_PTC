import { Pressable, StyleSheet, Text, View } from "react-native";
import ColorSwatch from "../ui/ColorSwatch";
import Icon from "../ui/Icon";
import LevelMeter from "../ui/LevelMeter";
import { colors, getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatNumber, formatRelativeDay } from "../../lib/format";
import { unitShort } from "../../lib/inventoryOptions";
import { isRecentInbound, stockFillPercent, stockLevel, STOCK_LEVEL_TONE } from "../../lib/stockLevel";

// Fila de un artículo de inventario (Producto terminado o Materia prima):
// nombre y existencia, y debajo la bodega, el medidor y el nivel según
// lib/stockLevel.js. Bajo mínimo lleva fondo rowAlert; un ingreso reciente
// desde Fabricación, fondo rowNew y la línea «+N de Fabricación · lote · hoy»
// (tiene prioridad el fondo de bajo mínimo, como en la web).
export default function StockRow({ item, showColor = false, onPress, onLongPress }) {
  const level = stockLevel(item);
  const tone = getTone(STOCK_LEVEL_TONE[level]);
  const recent = isRecentInbound(item);
  const background = level === "Bajo mínimo" ? colors.rowAlert : recent ? colors.rowNew : colors.surface;
  const name = showColor ? [item.name, item.color].filter(Boolean).join(" · ") : item.name;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint="Toca para editar; mantén presionado para más opciones"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface2 : background }]}
    >
      <View style={styles.top}>
        {showColor ? <ColorSwatch color={item.color} /> : null}
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.stock}>
          {formatNumber(item.stock)} {unitShort(item.unit)}
        </Text>
      </View>

      {recent ? (
        <View style={styles.inbound}>
          <Icon name="arrowUp" size={12} color={getTone("green").text} strokeWidth={2.4} />
          <Text style={styles.inboundText} numberOfLines={1}>
            {[
              `+${formatNumber(item.lastInbound.quantity)} de Fabricación`,
              item.lastInbound.batchNumber,
              formatRelativeDay(item.lastInbound.at),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <Text style={styles.location} numberOfLines={1}>
          {item.location || "—"}
        </Text>
        <LevelMeter value={stockFillPercent(item)} tone={STOCK_LEVEL_TONE[level]} style={styles.meter} />
        <Text style={[styles.level, { color: tone.text }]}>{level}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 6,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  stock: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  inbound: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inboundText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: getTone("green").text,
    fontVariant: ["tabular-nums"],
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  location: {
    width: 104,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.muted,
  },
  meter: {
    flex: 1,
  },
  level: {
    minWidth: 76,
    textAlign: "right",
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
});
