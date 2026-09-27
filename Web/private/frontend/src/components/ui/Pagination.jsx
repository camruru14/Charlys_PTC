import { IconChevronDown } from "../../lib/icons";
import { fmtNumber } from "../../lib/format";

const arrowClass =
  "flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border border-line bg-surface text-ink-2 transition enabled:hover:bg-surface-2 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

/*
  Pie de paginación de una lista: «1–8 de 23» y flechas anterior/siguiente.
    page: índice desde 0 · size: filas por página · total: registros
*/
function Pagination({ page, size, total, onChange, noun = "registros" }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = page * size + 1;
  const to = Math.min(total, from + size - 1);
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-5 py-2">
      <span className="t-aux tabular-nums">
        {fmtNumber(from)}–{fmtNumber(to)} de {fmtNumber(total)} {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={arrowClass} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Página anterior" title="Página anterior">
          <IconChevronDown width={15} height={15} className="rotate-90" />
        </button>
        <span className="min-w-[52px] text-center text-[12px] font-semibold tabular-nums text-ink-2">
          {fmtNumber(page + 1)} / {fmtNumber(pages)}
        </span>
        <button type="button" className={arrowClass} disabled={page >= pages - 1} onClick={() => onChange(page + 1)} aria-label="Página siguiente" title="Página siguiente">
          <IconChevronDown width={15} height={15} className="-rotate-90" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
