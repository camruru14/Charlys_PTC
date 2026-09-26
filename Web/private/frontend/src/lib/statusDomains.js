/*
  Mapa de estados de negocio -> tono, agrupado por dominio. Es la única fuente
  de color de estados del panel (la consume <StatusPill domain="..." />): un
  mismo texto puede tener distinto color según el dominio (ej. "Pendiente" es
  gris en un pedido pero ámbar en un pago).
  Tonos: gray, blue, amber, green, rose, purple, teal.
*/
export const STATUS_DOMAINS = {
  pedido: {
    Pendiente: "gray",
    Procesando: "blue",
    "En Fabricación": "amber",
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
  },
  stock: {
    Suficiente: "green",
    Estable: "blue",
    "Bajo mínimo": "rose",
  },
  transaccion: {
    Pagado: "blue",
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
