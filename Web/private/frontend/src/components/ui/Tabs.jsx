/*
  Pestañas de módulo. tabs = [{ key, label }]. La pestaña activa debe vivir en
  la URL (?tab=): úsalo junto con useUrlState("tab", ...).
*/
function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-[3px] self-start overflow-x-auto rounded-[11px] border border-line bg-surface p-[3px]">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`h-8 shrink-0 whitespace-nowrap rounded-[8px] px-[13px] text-[12.5px] font-semibold transition ${
              active ? "bg-primary-soft text-primary-soft-text" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
