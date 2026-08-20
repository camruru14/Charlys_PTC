// Utilidades de formato compartidas por las pantallas de la Fase 2, para no
// repetir Intl.NumberFormat/Date en cada pantalla. Mismo criterio ("es-SV")
// que Web/private/frontend/src/pages/Dashboard.jsx.
export function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-SV");
}

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-SV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Utilidades para los date pickers de la Fase 3 (startDate/endDate de lotes,
// date de lotes diarios y transacciones): el valor de formulario se guarda
// como "yyyy-mm-dd" (mismo criterio que todayInput()/toDateInput() de
// Web/private/frontend/src/hooks/useBatchForm.js), y se manda tal cual al
// backend, que lo castea a medianoche UTC de ese día calendario.
// "Hoy" en el calendario LOCAL del dispositivo -> "yyyy-mm-dd".
export function todayInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// Fecha ya guardada (instante UTC) -> "yyyy-mm-dd" para precargar el
// formulario. Se lee en UTC (no en el huso local) porque así fue guardada:
// evita correrla un día hacia atrás en husos detrás de UTC (ej. El Salvador).
export function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Hora local (ej. "07:32 a. m."), usada por Marcar Asistencia (Fase 4) para
// mostrar checkIn/checkOut. A diferencia de formatDate, estos sí son
// instantes reales (new Date() al marcar), así que se leen en el huso local.
export function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" });
}

// Formatea un DUI de 9 dígitos guardados sin guión (ver
// EmpleadoFormScreen.handleDuiChange) al formato "########-#" que usa el
// panel web. Si no son 9 dígitos, se muestra tal cual.
export function formatDui(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}
