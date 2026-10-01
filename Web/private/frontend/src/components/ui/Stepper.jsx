import { IconCheck } from "../../lib/icons";

/*
  Stepper de N pasos con nombre y fecha.
  steps = [{ label, date, state }] con state: "done" | "current" | "pending" | "skipped"
  done = verde con check, current = azul, pending = gris, skipped = gris tachado.

  variant="progress" (Fabricación > Pedidos): sin números. done = círculo azul
  relleno con ✓, current = círculo con borde azul y un punto azul, pending =
  círculo gris vacío; la línea es azul hasta el paso actual y gris después.
  La etiqueta va en negrita y `date` es el subtítulo (texto libre).
*/

const CIRCLE = {
  done: "bg-tone-green-dot text-white",
  current: "bg-tone-blue-dot text-white ring-4 ring-tone-blue",
  pending: "border-2 border-line bg-surface text-faint",
  skipped: "border-2 border-dashed border-line bg-surface text-faint",
};

const LABEL = {
  done: "text-ink",
  current: "text-tone-blue-text",
  pending: "text-muted",
  skipped: "text-faint line-through",
};

function ProgressStepper({ steps }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((step, i) => {
        const state = step.state || "pending";
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className={`flex items-start ${last ? "" : "flex-1"}`}>
            <div className="flex w-[116px] flex-col items-center text-center">
              <span
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
                  state === "done"
                    ? "bg-tone-blue-dot text-white"
                    : state === "current"
                      ? "border-2 border-tone-blue-dot bg-surface"
                      : "border-2 border-line bg-surface"
                }`}
              >
                {state === "done" ? <IconCheck width={12} height={12} strokeWidth={2.8} /> : null}
                {state === "current" ? <span className="h-2 w-2 rounded-full bg-tone-blue-dot" /> : null}
              </span>
              <span className={`mt-1.5 text-[12.5px] font-bold ${state === "pending" ? "text-muted" : "text-ink"}`}>{step.label}</span>
              <span className="mt-0.5 text-[11.5px] tabular-nums text-muted">{step.date || "—"}</span>
            </div>
            {last ? null : <span className={`mt-[10px] h-[2px] flex-1 rounded ${state === "done" ? "bg-tone-blue-dot" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Stepper({ steps, variant = "default" }) {
  if (variant === "progress") return <ProgressStepper steps={steps} />;
  return (
    <ol className="flex w-full items-start">
      {steps.map((step, i) => {
        const state = step.state || "pending";
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className={`flex items-start ${last ? "" : "flex-1"}`}>
            <div className="flex w-[84px] flex-col items-center text-center">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${CIRCLE[state]}`}>
                {state === "done" ? <IconCheck width={13} height={13} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className={`mt-1.5 text-[12px] font-semibold ${LABEL[state]}`}>{step.label}</span>
              <span className="t-aux tabular-nums">{state === "skipped" ? "omitido" : step.date || "—"}</span>
            </div>
            {last ? null : (
              <span className={`mt-3 h-[2px] flex-1 rounded ${state === "done" ? "bg-tone-green-dot" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
