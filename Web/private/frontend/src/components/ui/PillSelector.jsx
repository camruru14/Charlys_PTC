/*
  Pastillas de selección (ej. motorista o vehículo).
  options = [{ value, label, busy, unseen }]: las ocupadas llevan « · en ruta» y no
  son clicables. `unseen`: registro con novedades (punto azul hasta que se elige).
*/
function PillSelector({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        if (o.busy) {
          return (
            <span
              key={o.value}
              aria-disabled="true"
              className="inline-flex h-[27px] items-center whitespace-nowrap rounded-full border border-dashed border-busy-line bg-busy px-3 text-[12px] font-semibold text-faint"
            >
              {o.label} · en ruta
            </span>
          );
        }
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-[27px] items-center whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold transition ${
              selected ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-2 hover:border-select-bar"
            }`}
          >
            {o.unseen ? (
              <span role="img" aria-label="Nuevo" className={`mr-1.5 h-2 w-2 shrink-0 rounded-full ${selected ? "bg-white" : "bg-primary"}`} />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default PillSelector;
