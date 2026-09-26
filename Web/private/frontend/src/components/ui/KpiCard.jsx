import { TONE_SOFT } from "../../lib/tones";

/*
  Indicador en tarjeta (KpiCard): etiqueta en mayúsculas 11px, valor 25px/600
  y nota 12px. `trend` ({ tone, label }) se mantiene por compatibilidad con las
  páginas existentes y se muestra como la nota, en el color de texto del tono.
    iconTone        ícono dentro de un cuadro de 32px del tono suave (blue,
                    green, teal…); sin él, el ícono va suelto en faint.
    noteTone        color de `note` (por defecto muted).
    valueClassName  clases extra del valor (p. ej. color del neto).
    extra           contenido junto a la nota (p. ej. variación %).
*/

const NOTE_TONES = {
  green: "text-tone-green-text",
  red: "text-tone-rose-text",
  rose: "text-tone-rose-text",
  yellow: "text-tone-amber-text",
  amber: "text-tone-amber-text",
  blue: "text-tone-blue-text",
  teal: "text-tone-teal-text",
  gray: "text-muted",
};

function KpiCard({ label, value, note, noteTone, icon: Icon, iconTone, trend, valueClassName = "", extra }) {
  const noteText = note ?? trend?.label;
  const noteClass = note ? NOTE_TONES[noteTone] || "text-muted" : NOTE_TONES[trend?.tone] || "text-muted";

  return (
    <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{label}</p>
        {Icon && iconTone ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${TONE_SOFT[iconTone] || TONE_SOFT.gray}`}>
            <Icon width={16} height={16} />
          </span>
        ) : Icon ? (
          <Icon width={16} height={16} className="shrink-0 text-faint" />
        ) : null}
      </div>
      <p className={`t-kpi truncate ${iconTone ? "-mt-1" : "mt-2"} ${valueClassName}`}>{value}</p>
      {noteText || extra ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          {extra}
          {noteText ? <span className={noteClass}>{noteText}</span> : null}
        </p>
      ) : null}
      {trend?.caption ? <p className="mt-0.5 text-xs text-muted">{trend.caption}</p> : null}
    </div>
  );
}

export default KpiCard;
