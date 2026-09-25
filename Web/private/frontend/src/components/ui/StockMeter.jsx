import ProgressBar from "./ProgressBar";

/*
  Medidor de existencia: barra de 6px sobre line-soft + etiqueta de 92px
  (11.5px/600) en el color de texto del tono.
    <StockMeter percent={62} tone="blue" label="Estable" />
  El nivel y el porcentaje los calcula lib/stockLevel.js.
*/

const LABEL_TONE = {
  gray: "text-tone-gray-text",
  blue: "text-tone-blue-text",
  amber: "text-tone-amber-text",
  green: "text-tone-green-text",
  rose: "text-tone-rose-text",
  purple: "text-tone-purple-text",
  teal: "text-tone-teal-text",
};

function StockMeter({ percent = 0, tone = "blue", label }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProgressBar value={percent} max={100} tone={tone} className="min-w-0 flex-1" />
      {label != null ? (
        <span className={`w-[92px] shrink-0 text-[11.5px] font-semibold ${LABEL_TONE[tone] || LABEL_TONE.gray}`}>{label}</span>
      ) : null}
    </div>
  );
}

export default StockMeter;
