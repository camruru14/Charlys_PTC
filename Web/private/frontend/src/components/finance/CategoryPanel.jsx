import { Link } from "react-router-dom";
import BudgetBar from "./BudgetBar";
import { IconAlert, IconChevronRight } from "../../lib/icons";
import { categoryIcon, categoryTone } from "../../lib/expenseCategories";
import { budgetAlert, budgetNote, categoryRows, cents, daysInMonth, expenseTotal, money, rangeInfo } from "../../lib/finance";
import { fmtMonth } from "../../lib/format";

/*
  Panel «Gastos por categoría» de Finanzas (columna izquierda).
    · el total pagado del rango, su variación contra el período anterior y una
      barra apilada con un color por categoría;
    · una fila por categoría con lo pagado, lo que está por pagar y, si el rango
      viene de «Por mes», su barra contra el presupuesto;
    · un solo aviso: el más importante.
  Tocar una fila filtra el libro por esa categoría (otro toque quita el filtro).
*/

const NOTE_TEXT = { rose: "text-tone-rose-text", amber: "text-tone-amber-text", gray: "text-muted" };
const ALERT_STYLE = {
  3: "border-tone-rose-dot/40 bg-tone-rose text-tone-rose-text",
  2: "border-tone-rose-dot/25 bg-tone-rose/60 text-tone-rose-text",
  1: "border-tone-amber-dot/40 bg-tone-amber text-tone-amber-text",
};

// «Del 1 al 12 de octubre», «Del 28 de sept. al 12 de octubre», «Todo el historial».
function rangeText(range, now) {
  if (!range?.from || !range?.to) return "Todo el historial";
  const from = range.from;
  const to = range.to > now ? now : range.to;
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return from.getDate() === to.getDate() ? `${from.getDate()} de ${fmtMonth(to)}` : `Del ${from.getDate()} al ${to.getDate()} de ${fmtMonth(to)}`;
  }
  const year = (d) => (d.getFullYear() === now.getFullYear() ? "" : ` de ${d.getFullYear()}`);
  return `Del ${from.getDate()} de ${fmtMonth(from)}${year(from)} al ${to.getDate()} de ${fmtMonth(to)}${year(to)}`;
}

function Variation({ pct, label }) {
  if (pct == null) return label ? <span className="t-aux">{label} · sin gasto en ese período</span> : null;
  const up = pct > 0;
  const rounded = Math.round(Math.abs(pct));
  return (
    <span className="t-aux">
      <span className={`font-semibold tabular-nums ${up ? "text-tone-amber-text" : rounded === 0 ? "text-muted" : "text-tone-green-text"}`}>
        {rounded === 0 ? "±0%" : `${up ? "+" : "−"}${rounded}%`}
      </span>{" "}
      {label}
    </span>
  );
}

function CategoryPanel({ transactions, categories, range, selected, onSelect, onSeeMonth, loading, error, now = new Date() }) {
  const { months, currentMonthOnly } = rangeInfo(range, now);
  const rows = categoryRows({ transactions, categories, range, now });
  const { total, pct, label } = expenseTotal(transactions, range, now);
  const dayPct = currentMonthOnly ? (now.getDate() / daysInMonth(now)) * 100 : null;
  const alert = months ? budgetAlert(rows, { currentMonthOnly, now }) : null;
  const paidTotal = rows.reduce((s, r) => s + cents(r.paid), 0) / 100;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface" aria-label="Gastos por categoría">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="t-card-title">Gastos por categoría</h2>
          <p className="t-aux mt-0.5">
            {rangeText(range, now)} · {months ? "contra presupuesto" : "lo gastado"}
          </p>
        </div>
        <Link
          to="/configuracion?tab=categorias"
          className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-primary-soft-text transition hover:text-primary"
        >
          Presupuestos
          <IconChevronRight width={14} height={14} />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft px-5 pb-4 pt-3.5">
        {loading ? (
          <p className="t-aux py-6 text-center">Cargando…</p>
        ) : error ? (
          <p className="rounded-[10px] bg-tone-rose px-3 py-2 text-[12.5px] font-medium text-tone-rose-text">{error}</p>
        ) : (
          <>
            <p className="t-label">Gastos pagados</p>
            <p className="mt-0.5 text-[26px] font-bold leading-tight tabular-nums text-ink">{money(total)}</p>
            <Variation pct={pct} label={label} />

            {paidTotal > 0 ? (
              <div className="mt-2.5 flex h-2 gap-px overflow-hidden rounded-full bg-line-soft" aria-hidden="true">
                {rows
                  .filter((r) => r.paid > 0)
                  .map((r) => (
                    <span key={r.key} style={{ width: `${(r.paid / paidTotal) * 100}%`, backgroundColor: categoryTone(r.color).cssVar }} title={`${r.name} · ${money(r.paid)}`} />
                  ))}
              </div>
            ) : null}

            <div className="mt-3.5 flex flex-col gap-1">
              {rows.length === 0 ? (
                <p className="t-aux rounded-[10px] bg-surface-2 px-3 py-5 text-center">Sin gastos en este rango.</p>
              ) : (
                rows.map((row) => {
                  const Icon = categoryIcon(row.icon);
                  const tone = categoryTone(row.color);
                  const note = months ? budgetNote(row, { currentMonthOnly, dayPct: dayPct ?? 0 }) : null;
                  const active = selected === row.filterKey;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(active ? "" : row.filterKey)}
                      title={active ? "Quitar el filtro" : `Ver solo ${row.name} en el libro`}
                      className={`w-full rounded-[10px] border px-2.5 py-2 text-left transition ${
                        active ? "border-select-bar bg-primary-soft/60" : "border-transparent hover:bg-surface-2"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${tone.soft}`}>
                          <Icon width={14} height={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{row.name}</span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[13px] font-bold tabular-nums text-ink">{money(row.paid)}</span>
                          {row.pending > 0 ? <span className="block text-[11px] tabular-nums text-muted">+ {money(row.pending)} por pagar</span> : null}
                        </span>
                      </span>
                      {row.budget > 0 ? (
                        <>
                          <BudgetBar className="mt-2" paid={row.paid} pending={row.pending} budget={row.budget} color={row.color} dayPct={dayPct} />
                          <span className="mt-1 flex items-baseline justify-between gap-2 text-[11.5px]">
                            <span className={`font-medium ${NOTE_TEXT[note.tone]}`}>{note.text}</span>
                            <span className="shrink-0 tabular-nums text-muted">de {money(row.budget)}</span>
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            {months ? (
              <>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-3.5 rounded-full bg-tone-gray-dot" />
                    pagado
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-3.5 rounded-full" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--color-tone-gray-dot) 0 3px, transparent 3px 6px)" }} />
                    por pagar
                  </span>
                  {currentMonthOnly ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-px bg-ink/55" />
                      día {now.getDate()} de {daysInMonth(now)}
                    </span>
                  ) : null}
                </p>
                {alert ? (
                  <p className={`mt-3 flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-[1.45] ${ALERT_STYLE[alert.level]}`}>
                    <IconAlert width={15} height={15} className="mt-px shrink-0" />
                    <span>{alert.text}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] text-muted">
                Los presupuestos se ven por mes completo.{" "}
                <button type="button" onClick={onSeeMonth} className="font-semibold text-primary-soft-text transition hover:text-primary">
                  Ver {fmtMonth(now)}
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default CategoryPanel;
