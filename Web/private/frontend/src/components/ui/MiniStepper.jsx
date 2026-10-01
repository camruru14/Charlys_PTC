import { TONE_DOT } from "../../lib/tones";

/*
  Mini stepper: fila de segmentos de color, uno por paso o por línea.
  segments = [{ tone, label? }] (tone: ver lib/tones.js; sin tone = pendiente)
  size: "md" (6px) | "sm" (4px, listas compactas)
*/
function MiniStepper({ segments, className = "", size = "md" }) {
  return (
    <div className={`flex w-full gap-[3px] ${className}`}>
      {segments.map((s, i) => (
        <span
          key={i}
          title={s.label}
          className={`${size === "sm" ? "h-1" : "h-1.5"} flex-1 rounded-[2px] ${s.tone ? TONE_DOT[s.tone] : "bg-line-soft"}`}
        />
      ))}
    </div>
  );
}

export default MiniStepper;
