import { TONE_SOFT } from "../../lib/tones";

/*
  Chips de filtro «Etiqueta · N».
  options = [{ key, label, count, tone }]. El chip con key "all" (Todos) se
  muestra siempre; los demás se ocultan cuando su conteo es 0, salvo con
  showEmpty (para chips que deben verse aunque estén en 0).
  compact: chips de 24px en UNA sola fila (sin salto de línea; si no caben,
  la fila se desplaza en horizontal).
*/
function FilterChips({ options, value, onChange, showEmpty = false, compact = false }) {
  return (
    <div className={compact ? "flex flex-nowrap gap-1 overflow-x-auto" : "flex flex-wrap gap-1.5"}>
      {options
        .filter((o) => showEmpty || o.key === "all" || o.count > 0)
        .map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`whitespace-nowrap font-semibold tabular-nums transition ${
                compact ? "h-6 shrink-0 rounded-[7px] px-2 text-[11px]" : "h-[26px] rounded-[8px] px-2.5 text-[11.5px]"
              } ${
                active ? "bg-primary text-white" : TONE_SOFT[o.tone] || TONE_SOFT.gray
              }`}
            >
              {o.label}
              {o.count != null ? ` · ${o.count}` : ""}
            </button>
          );
        })}
    </div>
  );
}

export default FilterChips;
