import { fmtMoney, fmtCompactMoney } from "../../lib/format";

/*
  «Ingresos y gastos por mes» de Finanzas: barras propias (sin librerías).
    months   = [{ key, label, title, income, expense, current }]
               label «Sep», title «Septiembre 2026», current = mes en curso
    selected = key del mes que muestra el recuadro flotante
    onSelect(key)
  Medidas: eje Y de 52px, área de 160px, dos barras de 34px pegadas (gap 2px,
  radio 4px arriba) por mes y 26px entre meses.
*/

const AREA_H = 160;
const NICE_STEPS = [1, 2, 4, 5, 10];

// Tope «redondo» de la escala: 17,300 -> 20,000 (y la mitad, 10,000).
function niceTop(max) {
  if (!(max > 0)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = NICE_STEPS.find((s) => s * magnitude >= max);
  return step * magnitude;
}

const SERIES = [
  { key: "income", label: "Ingresos", className: "bg-chart-1" },
  { key: "expense", label: "Gastos", className: "bg-chart-2" },
];

function Legend() {
  return (
    <div className="flex items-center gap-4">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-2 text-[12px] font-semibold text-muted">
          <span className={`h-[11px] w-[11px] rounded-[3px] ${s.className}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MonthCard({ month }) {
  const net = month.income - month.expense;
  return (
    <div className="absolute right-0 top-0 z-10 w-[196px] rounded-[10px] border border-line bg-surface px-3.5 py-3 shadow-soft">
      <p className="text-[13px] font-bold text-ink">{month.title}</p>
      <dl className="mt-2 space-y-1.5 text-[12.5px]">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted">
              <span className={`h-2 w-2 rounded-[3px] ${s.className}`} />
              {s.label}
            </dt>
            <dd className="font-semibold tabular-nums text-ink">{fmtMoney(month[s.key])}</dd>
          </div>
        ))}
      </dl>
      <div className="my-2 h-px bg-line-soft" />
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="font-semibold text-ink-2">Neto</span>
        <span className={`font-bold tabular-nums ${net < 0 ? "text-tone-rose-text" : "text-tone-green-text"}`}>
          {net < 0 ? "−" : "+"}
          {fmtMoney(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}

function MonthlyChart({ months, selected, onSelect }) {
  const max = Math.max(0, ...months.flatMap((m) => [m.income, m.expense]));
  const top = niceTop(max);
  const ticks = top ? [top, top / 2, 0] : [0];
  const height = (v) => (top && v > 0 ? Math.max((v / top) * AREA_H, 2) : 0);
  const selectedMonth = months.find((m) => m.key === selected) || months[months.length - 1];

  return (
    <section className="rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="t-card-title">Ingresos y gastos por mes</h2>
          <p className="t-aux mt-0.5">Dólares · últimos seis meses</p>
        </div>
        <Legend />
      </div>

      <div className="overflow-x-auto px-5 pb-5 pt-4">
        <div className="relative min-w-[560px]">
          {selectedMonth ? <MonthCard month={selectedMonth} /> : null}
          <div className="flex">
            {/* Eje Y */}
            <div className="relative w-[52px] shrink-0" style={{ height: AREA_H }}>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute left-0 -translate-y-1/2 text-[11px] font-medium tabular-nums text-subtle"
                  style={{ top: top ? AREA_H - (t / top) * AREA_H : AREA_H }}
                >
                  {fmtCompactMoney(t)}
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              {/* Área con grilla */}
              <div className="relative" style={{ height: AREA_H }}>
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute inset-x-0 border-t border-chart-grid"
                    style={{ top: top ? AREA_H - (t / top) * AREA_H : AREA_H }}
                  />
                ))}
                <div className="absolute inset-0 flex items-end gap-[26px]">
                  {months.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => onSelect(m.key)}
                      aria-pressed={m.key === selectedMonth?.key}
                      title={m.title}
                      className="flex h-full items-end gap-[2px]"
                    >
                      {SERIES.map((s) => (
                        <span
                          key={s.key}
                          className={`block w-[34px] rounded-t-[4px] ${s.className}`}
                          style={{ height: height(m[s.key]) }}
                        />
                      ))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meses */}
              <div className="flex gap-[26px] pt-2">
                {months.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onSelect(m.key)}
                    className={`w-[70px] text-center text-[12px] ${m.current ? "font-bold text-ink" : "font-semibold text-subtle"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MonthlyChart;
