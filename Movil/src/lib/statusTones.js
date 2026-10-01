// Mapa de estados de negocio -> tono, agrupado por dominio. Copia de
// Web/private/frontend/src/lib/statusDomains.js: un mismo estado tiene el
// mismo tono en todos los dominios, con una sola excepción intencional:
// "Pendiente" es gris en los dominios operativos (pedido, ruta, parada) y
// ámbar en los financieros (transacción).
// Criterio: azul = pasando ahora mismo (Procesando, En proceso, En
// fabricación, Recolectando); ámbar = programado o en espera (Programado,
// Esperando lote, Por enviar).
// Tonos: gray, blue, amber, green, rose, purple, teal (ver lib/theme.js).
export const STATUS_DOMAINS = {
  pedido: {
    Pendiente: "gray",
    Procesando: "blue",
    "En Fabricación": "blue",
    Empacado: "purple",
    "En Tránsito": "teal",
    Entregado: "green",
  },
  "pedido-inventario": {
    "Sin verificar": "gray",
    Verificando: "blue",
    "Listo para empacar": "green",
    "Esperando lote": "amber",
    Empacado: "purple",
  },
  "linea-inventario": {
    "Por verificar": "gray",
    Verificado: "green",
    Empacado: "purple",
    "Existencia parcial": "amber",
    "Sin existencia": "rose",
    "En fabricación": "blue",
  },
  lote: {
    Programado: "amber",
    "En proceso": "blue",
    Detenido: "rose",
    Completado: "green",
    "Por enviar": "amber",
    "Completado · por enviar": "amber",
    "En bodega": "green",
    Empacado: "purple",
  },
  "pedido-fabricacion": {
    Programado: "amber",
    "En proceso": "blue",
    "En proceso · detenido": "rose",
    "Por empacar": "green",
    Empacado: "purple",
  },
  ruta: {
    Pendiente: "gray",
    Recolectando: "blue",
    "En tránsito": "teal",
    Completada: "green",
    Demorada: "rose",
  },
  parada: {
    Pendiente: "gray",
    Listo: "green",
    Incompleto: "amber",
    "En tránsito": "teal",
    Entregado: "green",
  },
  despacho: {
    Listo: "green",
    // "Faltan N de M" (ámbar) es dinámico: lo resuelve statusTone()
    Esperando: "gray",
    // Pedido que volvió de una entrega parcial
    "Entrega parcial": "amber",
  },
  // Lo que le falta a un pedido incompleto en Para despacho (mismos tonos que
  // el estado del lote o de la línea de la que viene cada texto).
  falta: {
    detenido: "rose",
    "en proceso": "blue",
    programado: "amber",
    "completado sin empacar": "green",
    "en fabricación": "blue",
    "verificado sin empacar": "green",
    "sin verificar": "gray",
  },
  stock: {
    Suficiente: "green",
    Estable: "blue",
    "Bajo mínimo": "rose",
  },
  transaccion: {
    Pagado: "green",
    Pendiente: "amber",
    Completado: "green",
  },
  catalogo: {
    Destacado: "blue",
    Activo: "green",
    Inactivo: "gray",
  },
  empleado: {
    Activo: "green",
    Inactivo: "gray",
  },
  // Líneas de producción (Configuración)
  linea: {
    Activa: "green",
    Inactiva: "gray",
  },
  asistencia: {
    Completo: "green",
    "Con extra": "blue",
    Tarde: "amber",
    Ausente: "rose",
  },
  vehiculo: {
    Disponible: "green",
    "En ruta": "teal",
  },
};

// Unifica variantes de escritura que llegan del backend ("En Proceso").
const ALIASES = {
  "En Proceso": "En proceso",
};

export function normalizeStatus(status) {
  if (status == null) return "";
  return ALIASES[status] || status;
}

export function statusTone(status, domain) {
  const label = normalizeStatus(status);
  if (domain === "despacho") {
    // «Faltan N de M» es ámbar; «Listo · N de M» y «Esperando · N de M» toman
    // el tono de su prefijo.
    if (/^Faltan \d+ de \d+$/.test(label)) return "amber";
    const prefix = label.split(" · ")[0];
    return STATUS_DOMAINS.despacho[prefix] || "gray";
  }
  return STATUS_DOMAINS[domain]?.[label] || "gray";
}

// ---- Atajos que ya usan las pantallas ----

export function transactionStatusTone(status) {
  return statusTone(status, "transaccion");
}

