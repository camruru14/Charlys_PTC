import { categoryTone } from "../../lib/expenseCategories";

/*
  Barra de presupuesto de una categoría (panel «Gastos por categoría» de
  Finanzas y tabla de Configuración › Categorías de gasto).
    · la parte pagada, sólida, con el color de la categoría (rosa si ya pasó);
    · lo que está por pagar, rayado;
    · una marca vertical fina en el día del mes (dayPct, 0–100; solo el mes en curso).
  La barra completa es el presupuesto: lo que lo pasa llena la barra y queda en rosa.
*/
function BudgetBar({ paid = 0, pending = 0, budget, color = "gray", dayPct = null, className = "" }) {
  const tone = categoryTone(color);
  const over = paid > budget;
  const solid = over ? "var(--color-tone-rose-dot)" : tone.cssVar;
  const paidPct = Math.min(100, (paid / budget) * 100);
  const allPct = Math.min(100, ((paid + pending) / budget) * 100);
  return (
    <div className={`relative h-[7px] rounded-full bg-line-soft ${className}`} role="img" aria-label={`Pagado ${Math.round((paid / budget) * 100)}% del presupuesto`}>
      <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${allPct}%` }}>
        {pending > 0 ? (
          <div
            className="absolute inset-0 opacity-70"
            style={{ backgroundImage: `repeating-linear-gradient(135deg, ${solid} 0 3px, transparent 3px 6px)` }}
            title="Por pagar"
          />
        ) : null}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: allPct ? `${(paidPct / allPct) * 100}%` : 0, backgroundColor: solid }} />
      </div>
      {dayPct != null ? (
        <span
          className="absolute -top-[2px] h-[11px] w-px bg-ink/55"
          style={{ left: `${Math.min(100, Math.max(0, dayPct))}%` }}
          title="Hoy"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

export default BudgetBar;
