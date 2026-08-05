import { useEffect, useRef } from "react";

/*
  Gráfico de barras agrupadas (ej. Ingresos vs Gastos).
  Recibe:
    data   = [{ label: "Ene", values: [12000, 8000] }, ...]
    series = [{ name: "Ingresos", color: "#2563eb" }, { name: "Gastos", color: "#f59e0b" }]

  Usa alturas en píxeles (no porcentajes) para que las barras siempre se rendericen
  de forma predecible, independientemente del contexto flex del contenedor.
*/

const LABEL_HEIGHT = 26; // espacio reservado para las etiquetas de mes

// Con pocas columnas (ej. 30 días ≈ 1-2 meses, 3 meses ≈ 3-4 meses) las barras
// por defecto se ven muy delgadas rodeadas de espacio vacío, así que se ensanchan
// a medida que hay menos columnas que llenar.
function barWidthClass(count) {
  if (count <= 2) return "w-10 sm:w-14";
  if (count <= 4) return "w-8 sm:w-10";
  if (count <= 8) return "w-6 sm:w-8";
  return "w-4 sm:w-6";
}

// Ancho mínimo por columna (px), a la par de barWidthClass, para que las
// columnas no queden más angostas que las barras que tienen que contener.
function minColumnWidth(count) {
  if (count <= 2) return 140;
  if (count <= 4) return 100;
  if (count <= 8) return 70;
  return 60;
}

// Columnas visibles antes de recurrir a scroll horizontal (ej. "Todo" con más de
// 12 meses de movimientos: se muestran 12 en la card y el resto se ve al hacer scroll).
const MAX_VISIBLE_COLUMNS = 12;

function BarChart({ data = [], series = [], height = 240, formatValue }) {
  const fmt = formatValue || ((v) => v.toLocaleString("es-SV"));
  const barsAreaH = Math.max(60, height - LABEL_HEIGHT);
  const scrollRef = useRef(null);

  // Cuando hay más columnas de las visibles (ej. "Todo" con más de 12 meses),
  // arranca mostrando el extremo derecho (los datos más recientes) y el usuario
  // hace scroll hacia la izquierda para ver el historial más antiguo.
  useEffect(() => {
    if (data.length > MAX_VISIBLE_COLUMNS && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  // Valor máximo (mínimo 1 para evitar división por cero)
  const max = Math.max(1, ...data.flatMap((d) => (d.values?.length ? d.values : [0])));

  // Líneas guía horizontales
  const gridLines = [0.25, 0.5, 0.75, 1];

  const colWidth = minColumnWidth(data.length);
  // Con 12 columnas o menos, el contenido llena el 100% de la card (como antes).
  // Con más de 12, el contenido crece en proporción (ej. 14 columnas = 116.7%)
  // para que las últimas 12 (las más recientes, gracias al useEffect de arriba
  // que arranca con scroll al extremo derecho) llenen la card exactamente, sin
  // dejar espacio vacío, y las más antiguas queden accesibles a la izquierda.
  const widthPercent =
    data.length > MAX_VISIBLE_COLUMNS ? `${(data.length / MAX_VISIBLE_COLUMNS) * 100}%` : "100%";

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1" ref={scrollRef}>
        <div style={{ width: widthPercent, minWidth: Math.max(data.length * colWidth, 240) }}>
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
                      className={`${barWidthClass(data.length)} rounded-t-md transition-all`}
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
