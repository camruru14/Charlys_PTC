/*
  Tarjeta de métrica (KPI Card).
  Bordes redondeados, sombra sutil, número grande, etiqueta descriptiva
  y un "pill" de porcentaje/estado (verde positivo, rojo alerta, amarillo acción).
*/

const TREND_TONES = {
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  yellow: "bg-amber-50 text-amber-700",
  blue: "bg-brand-50 text-brand-700",
};

function KpiCard({ label, value, icon: Icon, trend }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon width={18} height={18} />
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        {trend ? (
          <span
            className={`mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              TREND_TONES[trend.tone] || TREND_TONES.blue
            }`}
          >
            {trend.label}
          </span>
        ) : null}
      </div>

      {trend?.caption ? (
        <p className="mt-1 text-xs text-slate-400">{trend.caption}</p>
      ) : null}
    </div>
  );
}

export default KpiCard;
