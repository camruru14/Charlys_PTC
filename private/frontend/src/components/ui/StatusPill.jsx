/*
  Etiqueta de estado (Status Pill).
  Fondo suave + texto en negrita del mismo tono pero más oscuro,
  según las reglas de diseño:
    Verde   -> Completado / A tiempo / Entregado / Pagado
    Azul    -> En proceso / En Fabricación / Procesando
    Rojo    -> Demorado / Alertas / Detenido
    Amarillo-> En tránsito / Mantenimiento / Pendiente
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
  Pagado: "green",
  Activo: "green",
  Estable: "green",
  Suficiente: "green",
  Verificado: "green",
  // Azul
  "En proceso": "blue",
  "En Proceso": "blue",
  "En Fabricación": "blue",
  Procesando: "blue",
  Empacado: "blue",
  // Rojo
  Demorado: "red",
  Detenido: "red",
  Alerta: "red",
  Crítico: "red",
  Cancelado: "red",
  Insuficiente: "red",
  // Amarillo
  "En Tránsito": "yellow",
  "En tránsito": "yellow",
  Saliendo: "yellow",
  Mantenimiento: "yellow",
  Pendiente: "yellow",
  Programado: "yellow",
  "Sin Verificar": "yellow",
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
