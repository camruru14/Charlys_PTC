import { useCallback, useLayoutEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import CategoryAvatar from "../components/finance/CategoryAvatar";
import CategorySheet from "../components/finance/CategorySheet";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatMonth } from "../lib/format";
import { monthKey } from "../lib/expenseCategories";
import { money } from "../lib/finance";

// Configuración > Categorías de gasto (CategoriasGasto.jsx de la web): las
// categorías que aparecen al registrar un gasto en Finanzas, con su
// presupuesto mensual opcional del mes en curso. Tocar una abre su hoja
// (nombre, presupuesto, ícono y color, archivar); «Nueva categoría» abre la
// misma hoja vacía. Nunca se borran: se archivan y se restauran.
export default function ConfigCategoriasScreen({ navigation }) {
  const toast = useToast();
  const now = new Date();
  const month = monthKey(now);
  const monthName = formatMonth(now);
  const { categories, loading, refreshing, error, refresh, crear, actualizar, guardarPresupuestos } = useExpenseCategories({ usage: month });

  const [showArchived, setShowArchived] = useState(false);
  const [sheet, setSheet] = useState(null); // { category } | { category: null } (nueva)

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const total = active.reduce((s, c) => s + (Number(c.usage?.budget) || 0), 0);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Categorías de gasto", headerSubtitle: `Presupuesto mensual: ${money(total)}` });
  }, [navigation, total]);

  const restore = async (c) => {
    try {
      await actualizar(c._id, { archived: false });
      toast.show(`«${c.name}» restaurada`);
    } catch (err) {
      Alert.alert("No se pudo restaurar", err.message);
    }
  };

  if (loading && !categories.length) return <LoadingState />;
  if (error && !categories.length) return <ErrorState message={error} onRetry={refresh} />;

  const actions = { crear, actualizar, guardarPresupuestos, toast: (message) => toast.show(message) };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {showArchived ? (
          archived.length ? (
            <ListGroup>
              {archived.map((c) => (
                <View key={c._id} style={styles.row}>
                  <CategoryAvatar icon={c.icon} color="gray" />
                  <View style={styles.texts}>
                    <Text style={[styles.name, styles.archivedName]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.meta}>Archivada · {c.usage?.count ?? 0} mov. en {monthName}</Text>
                  </View>
                  <Button title="Restaurar" variant="secondary" size="small" onPress={() => restore(c)} />
                </View>
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="tag" message="No hay categorías archivadas." />
          )
        ) : (
          <>
            {active.length ? (
              <ListGroup>
                {active.map((c) => {
                  const usage = c.usage || { paid: 0, count: 0, budget: null };
                  return (
                    <Pressable
                      key={c._id}
                      onPress={() => setSheet({ category: c })}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}, ${usage.budget != null ? `${money(usage.budget)} al mes` : "sin presupuesto"}`}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <CategoryAvatar icon={c.icon} color={c.color} />
                      <View style={styles.texts}>
                        <Text style={styles.name} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          {usage.count} mov. · {money(usage.paid)} en {monthName}
                        </Text>
                      </View>
                      <View style={styles.budget}>
                        {usage.budget != null ? (
                          <>
                            <Text style={styles.budgetValue}>{money(usage.budget)}</Text>
                            <Text style={styles.meta}>al mes</Text>
                          </>
                        ) : (
                          <Text style={styles.meta}>Sin presupuesto</Text>
                        )}
                      </View>
                      <Icon name="chevronRight" size={18} color={colors.chevron} />
                    </Pressable>
                  );
                })}
                <View style={[styles.row, styles.fixed]}>
                  <CategoryAvatar name="orders" color="gray" />
                  <View style={styles.texts}>
                    <Text style={styles.name}>Ventas</Text>
                    <Text style={styles.meta}>Fija · solo ventas de la tienda</Text>
                  </View>
                  <Icon name="lock" size={16} color={colors.faint} />
                </View>
              </ListGroup>
            ) : (
              <>
                <EmptyState icon="tag" message="Aún no hay categorías de gasto. Crea la primera con «Nueva categoría»." />
              </>
            )}
          </>
        )}

        {archived.length || showArchived ? (
          <Pressable onPress={() => setShowArchived((v) => !v)} hitSlop={8} accessibilityRole="link" style={styles.link}>
            <Text style={styles.linkText}>{showArchived ? "Ver activas" : `Ver archivadas (${archived.length})`}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomBar
        actions={[
          {
            title: "Nueva categoría",
            icon: "plus",
            onPress: () => {
              setShowArchived(false);
              setSheet({ category: null });
            },
          },
        ]}
      />

      {sheet ? (
        <CategorySheet
          key={sheet.category?._id ?? "nueva"}
          category={sheet.category}
          month={month}
          monthName={monthName}
          actions={actions}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 10 },
  pressed: { backgroundColor: colors.surface2 },
  fixed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  archivedName: { color: colors.muted },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  budget: { alignItems: "flex-end", maxWidth: "36%" },
  budgetValue: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  link: { alignSelf: "center", paddingVertical: 12 },
  linkText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
});
