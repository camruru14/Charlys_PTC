// Claves de las pestañas con novedades. Espejo de
// Web/private/backend/src/lib/activityKeys.js y de
// Web/private/frontend/src/lib/activityKeys.js: deben mantenerse iguales. Cada
// clave es «módulo» o «módulo.pestaña»; el módulo es el nombre de la ruta del
// menú en minúsculas («Fabricacion» → «fabricacion»).
export const ACTIVITY_KEYS = [
  "pedidos",
  "inventario.terminado",
  "inventario.materia",
  "inventario.pedidos",
  "fabricacion.lotes",
  "fabricacion.diaria",
  "fabricacion.pedidos",
  "logistica.transito",
  "logistica.despacho",
  "finanzas",
  "empleados.personal",
];

export const moduleOfKey = (key) => key.split(".")[0];
