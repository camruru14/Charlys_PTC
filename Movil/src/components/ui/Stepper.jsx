import { Fragment, useState } from "react";
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

// Etiquetas: pueden ocupar más que su paso (LABEL_SPREAD veces su ancho),
// centradas bajo el círculo e invadiendo el tramo del conector, y solo
// saltan de línea en los espacios. La letra baja de 10.5 a 10 solo cuando
// la palabra más larga no cabe en el ancho del paso (estimación por
// caracteres, Figtree semibold ≈ 0.56 em por letra).
const LABEL_SPREAD = 1.5;
const LABEL_SIZE = 10.5;
const LABEL_SIZE_MIN = 10;
const CHAR_EM = 0.56;

function labelText(step) {
  return typeof step === "object" ? step.label : step;
}

export default function Stepper({ steps, current = 0, style }) {
  const states = steps.map((step, index) => stepState(step, index, current));
  const [width, setWidth] = useState(0);

  const stepWidth = width / Math.max(1, steps.length);
  const longestWord = Math.max(
    0,
    ...steps.flatMap((step) => String(labelText(step) ?? "").split(/\s+/).map((w) => w.length))
  );
  const labelSize = !width || longestWord * CHAR_EM * LABEL_SIZE <= stepWidth ? LABEL_SIZE : LABEL_SIZE_MIN;
  const labelStyle = { fontSize: labelSize, lineHeight: Math.round(labelSize * 1.25) };

  // Un paso está "alcanzado" si no está pendiente; el tramo que llega a él va
  // en verde.
  const reached = (i) => i >= 0 && i < states.length && states[i] !== "pending";

  return (
    <View style={[styles.row, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {steps.map((step, index) => {
        const label = labelText(step);
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
                style={[styles.label, labelStyle, (state === "pending" || state === "skipped") && styles.labelMuted]}
                textBreakStrategy="simple"
              >
                {label}
              </Text>
              {date ? (
                <Text style={[styles.date, styles.wide]} numberOfLines={1}>
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
    fontVariant: ["tabular-nums"],
  },
  numberCurrent: {
    color: colors.white,
  },
  // Más ancho que el paso y centrado: se sale por igual a los dos lados.
  wide: {
    width: `${LABEL_SPREAD * 100}%`,
  },
  label: {
    width: `${LABEL_SPREAD * 100}%`,
    fontFamily: fonts.semibold,
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
    fontVariant: ["tabular-nums"],
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
