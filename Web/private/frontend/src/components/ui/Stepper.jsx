import { IconCheck } from "../../lib/icons";

/*
  Stepper de N pasos con nombre y fecha.
  steps = [{ label, date, state }] con state: "done" | "current" | "pending" | "skipped"
  done = verde con check, current = azul, pending = gris, skipped = gris tachado.
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

function Stepper({ steps }) {
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
