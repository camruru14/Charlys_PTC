import { TONE_SOFT } from "../../lib/tones";

/*
  Indicador en tarjeta (KpiCard): etiqueta en mayúsculas 11px, valor 25px/600
  y nota 12px.
    iconTone        ícono dentro de un cuadro de 32px del tono suave (blue,
                    green, teal…); sin él, el ícono va suelto en faint.
    noteTone        color de `note` (green, rose, amber, blue, teal; por
                    defecto muted).
    valueClassName  clases extra del valor (p. ej. color del neto).
    extra           contenido junto a la nota (p. ej. variación %).
*/

const NOTE_TONES = {
  green: "text-tone-green-text",
  rose: "text-tone-rose-text",
  amber: "text-tone-amber-text",
  blue: "text-tone-blue-text",
  teal: "text-tone-teal-text",
};

function KpiCard({ label, value, note, noteTone, icon: Icon, iconTone, valueClassName = "", extra }) {
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
      {note || extra ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          {extra}
          {note ? <span className={NOTE_TONES[noteTone] || "text-muted"}>{note}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export default KpiCard;
