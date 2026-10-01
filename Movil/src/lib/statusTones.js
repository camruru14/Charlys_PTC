// Mapa de estados de negocio -> tono, agrupado por dominio. Copia de
// Web/private/frontend/src/lib/statusDomains.js: un mismo estado tiene el
// mismo tono en todos los dominios, con una sola excepción intencional:
// "Pendiente" es gris en los dominios operativos (pedido, ruta, parada) y
// ámbar en los financieros (pago, transacción).
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
  pago: {
    Pendiente: "amber",
    Pagado: "green",
    Reembolsado: "gray",
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

export function batchStatusTone(status) {
  return statusTone(status, "lote");
}

export function transactionStatusTone(status) {
  return statusTone(status, "transaccion");
}

export function paymentStatusTone(status) {
  return statusTone(status, "pago");
}

// La web ya no distingue un mapeo "global" y otro exclusivo de la lista de
// Pedidos: los dos usan el dominio "pedido".
export function orderStatusTone(status) {
  return statusTone(status, "pedido");
}

export function orderStatusToneDetailed(status) {
  return statusTone(status, "pedido");
}

export function inventoryStockTone(item) {
  const min = Number(item?.minStock || 0);
  const stock = Number(item?.stock || 0);
  if (min <= 0) return "gray";
  if (stock <= 0) return "rose";
  if (stock <= min) return "amber";
  return "gray";
}

// dispatchStatus de la entrega de un pedido. No tiene dominio propio en la
// web; se usa el mismo criterio que "ruta": en tránsito = teal, pasando
// ahora = azul, demorado = rose.
export function dispatchStatusTone(status) {
  switch (status) {
    case "Saliendo":
      return "blue";
    case "A tiempo":
      return "teal";
    case "Demorado":
      return "rose";
    case "Entregado":
      return "green";
    default:
      return "gray";
  }
}
