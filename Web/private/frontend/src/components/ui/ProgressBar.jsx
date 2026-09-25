import { TONE_DOT } from "../../lib/tones";

/* Barra de progreso simple (value/max) en el color de un tono. */
function ProgressBar({ value = 0, max = 100, tone = "blue", height = 6, className = "" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`w-full overflow-hidden rounded-[3px] bg-line-soft ${className}`} style={{ height }}>
      <div className={`h-full rounded-[3px] ${TONE_DOT[tone] || TONE_DOT.blue}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default ProgressBar;
