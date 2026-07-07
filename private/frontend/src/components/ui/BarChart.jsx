/*
  Gráfico de barras agrupadas (ej. Ingresos vs Gastos).
  Recibe:
    data   = [{ label: "Ene", values: [12000, 8000] }, ...]
    series = [{ name: "Ingresos", color: "#2563eb" }, { name: "Gastos", color: "#f59e0b" }]

  Usa alturas en píxeles (no porcentajes) para que las barras siempre se rendericen
  de forma predecible, independientemente del contexto flex del contenedor.
*/

const LABEL_HEIGHT = 26; // espacio reservado para las etiquetas de mes

function BarChart({ data = [], series = [], height = 240, formatValue }) {
  const fmt = formatValue || ((v) => v.toLocaleString("es-SV"));
  const barsAreaH = Math.max(60, height - LABEL_HEIGHT);

  // Valor máximo (mínimo 1 para evitar división por cero)
  const max = Math.max(1, ...data.flatMap((d) => (d.values?.length ? d.values : [0])));

  // Líneas guía horizontales
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: Math.max(data.length * 60, 240) }}>
          {/* Área de barras con líneas guía */}
          <div className="relative" style={{ height: barsAreaH }}>
            {gridLines.map((g) => (
              <div
                key={g}
                className="absolute inset-x-0 border-t border-dashed border-slate-100"
                style={{ bottom: g * barsAreaH }}
              />
            ))}

            <div className="absolute inset-0 flex items-end justify-between gap-3">
              {data.map((d, i) => (
                <div key={i} className="flex flex-1 items-end justify-center gap-1.5">
                  {d.values.map((v, j) => (
                    <div
                      key={j}
                      title={`${series[j]?.name || ""}: ${fmt(v)}`}
                      className="w-4 rounded-t-md transition-all sm:w-6"
                      style={{
                        height: v > 0 ? Math.max((v / max) * barsAreaH, 3) : 0,
                        backgroundColor: series[j]?.color || "#94a3b8",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Etiquetas */}
          <div className="flex justify-between gap-3" style={{ height: LABEL_HEIGHT }}>
            {data.map((d, i) => (
              <span
                key={i}
                className="flex-1 pt-2 text-center text-xs font-medium text-slate-400"
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default BarChart;
