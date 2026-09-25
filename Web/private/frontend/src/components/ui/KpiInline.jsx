import { TONE_DOT } from "../../lib/tones";

/*
  Indicadores en línea: cuadrito de color + etiqueta + valor.
  items = [{ label, value, tone }] (tone: ver lib/tones.js TONE_DOT)
*/
function KpiInline({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-[3px] ${TONE_DOT[item.tone] || TONE_DOT.gray}`} />
          <span className="text-[11.5px] font-semibold text-muted">{item.label}</span>
          <span className="t-kpi-inline">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default KpiInline;
