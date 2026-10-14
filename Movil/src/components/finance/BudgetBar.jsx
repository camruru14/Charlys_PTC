import { StyleSheet, View } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import { colors, tones } from "../../lib/theme";
import { categoryTone } from "../../lib/expenseCategories";
import { cents } from "../../lib/finance";

// Barra de presupuesto de una categoría (Resumen de Finanzas y Configuración ›
// Categorías de gasto), como BudgetBar de la web:
//   · lo pagado, sólido, con el color de la categoría (rosa si ya pasó);
//   · lo que está por pagar, rayado;
//   · una marca vertical fina en el día del mes (dayPct, 0–100; solo el mes en curso).
// La barra completa es el presupuesto: lo que lo pasa la llena y queda en rosa.
export default function BudgetBar({ paid = 0, pending = 0, budget, color = "gray", dayPct = null, style }) {
  const over = cents(paid) > cents(budget);
  const solid = over ? tones.rose.dot : categoryTone(color).dot;
  const paidPct = Math.min(100, (paid / budget) * 100);
  const allPct = Math.min(100, ((paid + pending) / budget) * 100);
  const patternId = `stripes-${String(color)}`;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="progressbar" accessibilityLabel={`Pagado ${Math.round((paid / budget) * 100)}% del presupuesto`}>
      <View style={styles.track}>
        {allPct > paidPct ? (
          <View style={[styles.pending, { left: `${paidPct}%`, width: `${allPct - paidPct}%` }]}>
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern id={patternId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <Rect width="3" height="6" fill={solid} opacity={0.75} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </Svg>
          </View>
        ) : null}
        {paidPct > 0 ? <View style={[styles.paid, { width: `${paidPct}%`, backgroundColor: solid }]} /> : null}
      </View>
      {dayPct != null ? <View style={[styles.marker, { left: `${Math.min(100, Math.max(0, dayPct))}%` }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 11, justifyContent: "center" },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.lineSoft, overflow: "hidden" },
  paid: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
  pending: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  marker: { position: "absolute", top: 0, width: 1, height: 11, backgroundColor: "rgba(22, 32, 58, 0.55)" },
});
