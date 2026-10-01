import { normalizeStatus, statusTone } from "../../lib/statusDomains";

/*
  Etiqueta de estado (Status Pill). ÚNICA fuente de color de estados en todo
  el panel: el color sale del mapa por dominio de lib/statusDomains.js, nunca
  de un tono pasado a mano.
    <StatusPill status="Empacado" domain="pedido" />
    size:    "sm" (filas) | "lg" (encabezados de detalle)
    variant: "pill" (con fondo) | "dot" (solo punto + texto, listas maestro)
*/

const TONES = {
  gray: { bg: "bg-tone-gray", text: "text-tone-gray-text", dot: "bg-tone-gray-dot", border: "border-tone-gray-dot/30" },
  blue: { bg: "bg-tone-blue", text: "text-tone-blue-text", dot: "bg-tone-blue-dot", border: "border-tone-blue-dot/30" },
  amber: { bg: "bg-tone-amber", text: "text-tone-amber-text", dot: "bg-tone-amber-dot", border: "border-tone-amber-dot/30" },
  green: { bg: "bg-tone-green", text: "text-tone-green-text", dot: "bg-tone-green-dot", border: "border-tone-green-dot/30" },
  rose: { bg: "bg-tone-rose", text: "text-tone-rose-text", dot: "bg-tone-rose-dot", border: "border-tone-rose-dot/30" },
  purple: { bg: "bg-tone-purple", text: "text-tone-purple-text", dot: "bg-tone-purple-dot", border: "border-tone-purple-dot/30" },
  teal: { bg: "bg-tone-teal", text: "text-tone-teal-text", dot: "bg-tone-teal-dot", border: "border-tone-teal-dot/30" },
};

function StatusPill({ status, domain, size = "sm", variant = "pill" }) {
  const label = normalizeStatus(status);
  const tone = TONES[statusTone(label, domain)];

  if (variant === "dot") {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold ${tone.text}`}>
        <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${tone.dot}`} />
        {label}
      </span>
    );
  }

  const sizing =
    size === "lg"
      ? `h-[26px] gap-1.5 rounded-[8px] border px-2.5 text-xs ${tone.border}`
      : "h-[22px] gap-1.5 rounded-[7px] px-2 text-[11px]";

  return (
    <span className={`inline-flex items-center whitespace-nowrap font-semibold ${sizing} ${tone.bg} ${tone.text}`}>
      <span className={`shrink-0 rounded-full ${size === "lg" ? "h-[7px] w-[7px]" : "h-1.5 w-1.5"} ${tone.dot}`} />
      {label}
    </span>
  );
}

export default StatusPill;
