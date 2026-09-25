import { TONE_SOFT } from "../../lib/tones";

/*
  Chips de filtro «Etiqueta · N».
  options = [{ key, label, count, tone }]. El chip con key "all" (Todos) se
  muestra siempre; los demás se ocultan cuando su conteo es 0.
*/
function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options
        .filter((o) => o.key === "all" || o.count > 0)
        .map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`h-[26px] whitespace-nowrap rounded-[8px] px-2.5 text-[11.5px] font-semibold tabular-nums transition ${
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
