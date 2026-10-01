import { useCallback, useLayoutEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useProductionLines } from "../hooks/useProductionLines";
import InlineNameRow from "../components/settings/InlineNameRow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

const inProcessText = (n) => `${formatNumber(n)} ${n === 1 ? "lote en proceso" : "lotes en proceso"}`;

// Configuración > Líneas de producción (LineasProduccion.jsx de la web). Las
// activas son las opciones al crear o iniciar un lote en Fabricación. El
// nombre se cambia en la fila (también actualiza los lotes que la usan); la
// Pill activa o desactiva la línea. Una línea con lotes en proceso no se
// puede eliminar y siempre debe quedar al menos una activa. «+» agrega una
// (LineaFormScreen).
export default function ConfigLineasScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { lines, loading, refreshing, error, refresh, actualizar, eliminar } = useProductionLines();
  const activeCount = lines.filter((l) => l.active).length;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Líneas de producción",
      headerSubtitle: "Las activas aparecen al crear o iniciar un lote",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => navigation.navigate("LineaForm")} accessibilityLabel="Agregar línea" />
      ),
    });
  }, [navigation]);

  // Motivo por el que no se puede eliminar.
  const deleteBlock = (line) => {
    if (line.inProcess > 0) return `tiene ${inProcessText(line.inProcess)}`;
    if (line.active && activeCount <= 1) return "es la única línea activa";
    return null;
  };

  const remove = (line) =>
    Alert.alert(
      "Eliminar línea",
      `¿Eliminar «${line.name}»? Ya no se podrá elegir al crear o iniciar lotes. Los lotes que ya la usan conservan el nombre.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminar(line._id);
              toast.show(`${line.name} eliminada`);
            } catch (err) {
              Alert.alert("No se pudo eliminar", err.message);
              refresh();
            }
          },
        },
      ],
    );

  const toggleActive = (line) => {
    if (line.active && activeCount <= 1) {
      Alert.alert("Línea activa", "Debe quedar al menos una línea activa.");
      return;
    }
    const next = !line.active;
    Alert.alert(
      next ? "Activar línea" : "Desactivar línea",
      next
        ? `«${line.name}» volverá a aparecer al crear o iniciar lotes.`
        : `«${line.name}» ya no aparecerá al crear o iniciar lotes.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: next ? "Activar" : "Desactivar",
          onPress: async () => {
            try {
              await actualizar(line._id, { active: next });
              toast.show(`${line.name} actualizada`);
            } catch (err) {
              Alert.alert("No se pudo actualizar", err.message);
            }
          },
        },
      ],
    );
  };

  if (loading && !lines.length) return <LoadingState />;
  if (error && !lines.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {lines.length ? (
        <ListGroup>
          {lines.map((line) => {
            const status = line.active ? "Activa" : "Inactiva";
            return (
              <InlineNameRow
                key={line._id}
                icon="factory"
                value={line.name}
                detail={line.inProcess > 0 ? inProcessText(line.inProcess) : "Sin lotes en proceso"}
                muted={!line.active}
                label="nombre de la línea"
                renameNote={(value) =>
                  value && value !== line.name ? `Los lotes que usan «${line.name}» pasarán a «${value}».` : null
                }
                onSave={async (name) => {
                  await actualizar(line._id, { name });
                  toast.show(`${name} actualizada`);
                }}
                right={
                  <Pressable
                    onPress={() => toggleActive(line)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${status}: tocar para ${line.active ? "desactivar" : "activar"}`}
                  >
                    <Pill label={status} tone={statusTone(status, "linea")} />
                  </Pressable>
                }
                onDelete={() => remove(line)}
                deleteBlocked={Boolean(deleteBlock(line))}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState icon="factory" message="No hay líneas registradas." />
      )}
      <Text style={styles.note}>
        Toca el estado para activar o desactivar una línea. Una línea con lotes en proceso, o la única activa, no se puede
        eliminar.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
