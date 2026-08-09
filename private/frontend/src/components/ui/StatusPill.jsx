/*
  Etiqueta de estado (Status Pill).
  Fondo suave + texto en negrita del mismo tono pero más oscuro. Este mapa es
  la ÚNICA fuente de verdad para el color de cada estado de negocio en todo
  el panel — cualquier componente que necesite pintar uno de estos conceptos
  debe usar <StatusPill status="..." /> en vez de armar su propio badge o
  pasar un tone a mano, así nunca se desincroniza entre pantallas:
    Gris     -> Sin verificar
    Azul     -> Verificado / En proceso / Procesando
    Amarillo -> En Fabricación / Enviado a fabricación / Recolectando / En tránsito / Pendiente
    Verde    -> Empacado / Entregado / Completado / A tiempo / Pagado
    Rojo     -> Demorado / Alertas / Detenido
*/

const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  yellow: "bg-amber-50 text-amber-700 ring-amber-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

// Mapa de estados de negocio -> tono de color
const STATUS_TONE = {
  // Verde
  Completado: "green",
  "A tiempo": "green",
  Entregado: "green",
  Empacado: "green",
  Pagado: "green",
  Activo: "green",
  Estable: "green",
  Suficiente: "green",
  // Azul
  "En proceso": "blue",
  "En Proceso": "blue",
  Procesando: "blue",
  Verificado: "blue",
  // Rojo
  Demorado: "red",
  Detenido: "red",
  Alerta: "red",
  Crítico: "red",
  Cancelado: "red",
  Insuficiente: "red",
  // Amarillo (mismo tono para "ámbar" y "amarillo": son el mismo concepto
  // visual, solo dos nombres distintos según el contexto)
  "En Tránsito": "yellow",
  "En tránsito": "yellow",
  "En Fabricación": "yellow",
  Recolectando: "yellow",
  Saliendo: "yellow",
  Mantenimiento: "yellow",
  Pendiente: "yellow",
  Programado: "yellow",
  // Gris
  "Sin Verificar": "gray",
};

function StatusPill({ status, tone }) {
  const resolvedTone = tone || STATUS_TONE[status] || "gray";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[resolvedTone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export default StatusPill;
