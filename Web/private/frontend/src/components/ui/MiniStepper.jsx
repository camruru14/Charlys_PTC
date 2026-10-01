import { TONE_DOT } from "../../lib/tones";

/*
  Mini stepper: fila de segmentos de color, uno por paso o por línea.
  segments = [{ tone, label? }] (tone: ver lib/tones.js; sin tone = pendiente)
*/
function MiniStepper({ segments, className = "" }) {
  return (
    <div className={`flex w-full gap-[3px] ${className}`}>
      {segments.map((s, i) => (
        <span
          key={i}
          title={s.label}
          className={`h-1.5 flex-1 rounded-[3px] ${s.tone ? TONE_DOT[s.tone] : "bg-line-soft"}`}
        />
      ))}
    </div>
  );
}

export default MiniStepper;
