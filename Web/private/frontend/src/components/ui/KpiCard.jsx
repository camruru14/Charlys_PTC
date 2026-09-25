/*
  Indicador en tarjeta (KpiCard): etiqueta en mayúsculas 11px, valor 25px/600
  y nota 12px. `trend` ({ tone, label }) se mantiene por compatibilidad con las
  páginas existentes y se muestra como la nota, en el color de texto del tono.
*/

const NOTE_TONES = {
  green: "text-tone-green-text",
  red: "text-tone-rose-text",
  rose: "text-tone-rose-text",
  yellow: "text-tone-amber-text",
  amber: "text-tone-amber-text",
  blue: "text-tone-blue-text",
  gray: "text-muted",
};

function KpiCard({ label, value, note, icon: Icon, trend }) {
  const noteText = note ?? trend?.label;
  const noteClass = note ? "text-muted" : NOTE_TONES[trend?.tone] || "text-muted";

  return (
    <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{label}</p>
        {Icon ? <Icon width={16} height={16} className="shrink-0 text-faint" /> : null}
      </div>
      <p className="t-kpi mt-2 truncate">{value}</p>
      {noteText ? <p className={`mt-0.5 text-xs ${noteClass}`}>{noteText}</p> : null}
      {trend?.caption ? <p className="mt-0.5 text-xs text-muted">{trend.caption}</p> : null}
    </div>
  );
}

export default KpiCard;
