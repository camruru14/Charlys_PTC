/*
  Opciones tipo tarjeta con radio.
  options = [{ value, title, detail, tag, disabled }]
*/
function RadioCardList({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[11px] px-3.5 py-3 transition ${
              selected ? "border-[1.5px] border-primary bg-select-bg" : "border border-line bg-surface hover:bg-surface-2"
            } ${o.disabled ? "cursor-not-allowed opacity-55" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span
              className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                selected ? "border-primary" : "border-line"
              }`}
            >
              {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink">{o.title}</span>
              {o.detail ? <span className="t-aux mt-0.5 block">{o.detail}</span> : null}
            </span>
            {o.tag ? (
              <span className="shrink-0 rounded-[6px] bg-primary-soft px-1.5 py-0.5 text-[10.5px] font-bold text-primary-soft-text">
                {o.tag}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export default RadioCardList;
