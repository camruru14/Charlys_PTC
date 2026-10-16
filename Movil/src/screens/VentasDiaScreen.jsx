import { useCallback, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatClock, formatShortDate } from "../lib/format";
import { money, plural } from "../lib/finance";
import { dayKey, isStoreSale, txDay } from "../lib/transactionFilters";
import { useBottomPad } from "../hooks/useBottomPad";

// Ventas de la tienda de un día (la fila «Ventas de la tienda» de Finanzas):
// pantalla de SOLO LECTURA con el total, los pedidos que entraron y su monto.
// Estas ventas las crea sola la tienda al cobrar con Wompi; no se editan ni se
// borran desde la app.
export default function VentasDiaScreen({ navigation, route }) {
  const day = route.params?.day; // "2026-10-12"
  const bottomPad = useBottomPad(32);
  const { transactions, loading, refreshing, error, refresh } = useTransactions();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const date = useMemo(() => {
    const [y, m, d] = String(day || "").split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  }, [day]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Ventas · ${date ? formatShortDate(date) : ""}`.trim(), headerBackTitle: "Finanzas" });
  }, [navigation, date]);

  const sales = useMemo(
    () =>
      transactions
        .filter((t) => isStoreSale(t) && t.type === "Ingreso" && txDay(t) && dayKey(txDay(t)) === day)
        .sort((a, b) => String(a.relatedOrder?.orderNumber || a.orderNumber).localeCompare(String(b.relatedOrder?.orderNumber || b.orderNumber))),
    [transactions, day],
  );
  const total = sales.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  if (loading && !transactions.length) return <LoadingState />;
  if (error && !transactions.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Card style={styles.total}>
        <Text style={type.overline}>Total del día</Text>
        <Text style={styles.totalValue}>{money(total)}</Text>
        <Text style={styles.totalNote}>{plural(sales.length, "pedido pagado", "pedidos pagados")} con Wompi</Text>
      </Card>

      {sales.length ? (
        <ListGroup>
          {sales.map((t) => (
            <View key={t._id} style={styles.row}>
              <View style={styles.texts}>
                <Text style={styles.order}>{t.relatedOrder?.orderNumber || t.orderNumber || t.reference}</Text>
                <Text style={styles.time}>
                  {[t.date ? formatClock(t.date) : "", t.paymentDemo ? "Pago de prueba" : ""].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={styles.amount}>+{money(Number(t.amount) || 0)}</Text>
            </View>
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon="orders" message="No hay ventas de la tienda este día." />
      )}

      <View style={styles.notice}>
        <Icon name="lock" size={16} color={colors.muted} />
        <Text style={styles.noticeText}>No se editan ni se borran desde Finanzas: el monto es el que cobró Wompi.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  total: { gap: 3 },
  totalValue: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.5, color: tones.green.text, fontVariant: ["tabular-nums"] },
  totalNote: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, paddingVertical: 10 },
  texts: { flex: 1, gap: 1 },
  order: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: tones.green.text, fontVariant: ["tabular-nums"] },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 12,
    marginTop: 2,
  },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted },
});
