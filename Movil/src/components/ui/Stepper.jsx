import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Pasos numerados en horizontal (recorrido de un pedido, un asistente).
// Dos formas de usarlo:
//   <Stepper steps={["Datos", "Productos", "Confirmar"]} current={1} />
//     los pasos antes de `current` salen completados y los siguientes
//     pendientes;
//   <Stepper steps={[{ label, state, date }]} />
//     cada paso trae su estado: done | current | pending | skipped (como
//     orderJourneySteps() de lib/orderJourney.js) y una fecha opcional.
// Completados en verde con check, el actual en azul con halo, pendientes
// solo con borde y omitidos con un guion.
function stepState(step, index, current) {
  if (typeof step === "object" && step.state) return step.state;
  return index < current ? "done" : index === current ? "current" : "pending";
}

const STATE_LABEL = { done: ", completado", current: ", actual", skipped: ", omitido", pending: "" };

export default function Stepper({ steps, current = 0, style }) {
  const states = steps.map((step, index) => stepState(step, index, current));

  // Un paso está "alcanzado" si no está pendiente; el tramo que llega a él va
  // en verde.
  const reached = (i) => i >= 0 && i < states.length && states[i] !== "pending";

  return (
    <View style={[styles.row, style]}>
      {steps.map((step, index) => {
        const label = typeof step === "object" ? step.label : step;
        const date = typeof step === "object" ? step.date : null;
        const state = states[index];
        return (
          <Fragment key={label}>
            <View style={styles.step} accessible accessibilityLabel={`Paso ${index + 1}: ${label}${STATE_LABEL[state]}`}>
              {/* Mitades del conector detrás del círculo: la izquierda llega a
                  este paso y la derecha sale hacia el siguiente. */}
              {index > 0 ? (
                <View style={[styles.connector, styles.connectorLeft, reached(index) && styles.connectorDone]} />
              ) : null}
              {index < steps.length - 1 ? (
                <View style={[styles.connector, styles.connectorRight, reached(index + 1) && styles.connectorDone]} />
              ) : null}
              <View style={[styles.halo, state === "current" && styles.haloCurrent]}>
                <View style={[styles.circle, styles[state]]}>
                  {state === "done" ? (
                    <Icon name="check" size={13} color={colors.white} strokeWidth={2.6} />
                  ) : state === "skipped" ? (
                    <Icon name="minus" size={13} color={colors.faint} strokeWidth={2.2} />
                  ) : (
                    <Text style={[styles.number, state === "current" && styles.numberCurrent]}>{index + 1}</Text>
                  )}
                </View>
              </View>
              <Text
                style={[styles.label, (state === "pending" || state === "skipped") && styles.labelMuted]}
                numberOfLines={2}
              >
                {label}
              </Text>
              {date ? (
                <Text style={styles.date} numberOfLines={1}>
                  {date}
                </Text>
              ) : null}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const CIRCLE = 24;
const HALO = 4;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 1,
  },
  halo: {
    padding: HALO,
    borderRadius: (CIRCLE + HALO * 2) / 2,
  },
  haloCurrent: {
    backgroundColor: colors.primarySoft,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    backgroundColor: tones.green.dot,
  },
  current: {
    backgroundColor: colors.primary,
  },
  pending: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  skipped: {
    backgroundColor: colors.busy,
    borderWidth: 1.5,
    borderColor: colors.busyLine,
    borderStyle: "dashed",
  },
  number: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.faint,
  },
  numberCurrent: {
    color: colors.white,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.ink,
    textAlign: "center",
  },
  labelMuted: {
    color: colors.muted,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: colors.faint,
    textAlign: "center",
  },
  connector: {
    position: "absolute",
    top: HALO + CIRCLE / 2 - 1,
    height: 2,
    backgroundColor: colors.line,
  },
  connectorLeft: {
    left: 0,
    right: "50%",
  },
  connectorRight: {
    left: "50%",
    right: 0,
  },
  connectorDone: {
    backgroundColor: tones.green.dot,
  },
});
