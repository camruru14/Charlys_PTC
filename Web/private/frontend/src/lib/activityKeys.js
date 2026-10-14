/*
  Claves de las pestañas con burbuja de novedades. Espejo de
  Web/private/backend/src/lib/activityKeys.js: deben mantenerse iguales. Cada
  clave es «módulo» o «módulo.pestaña»; el módulo es el de la URL y el menú
  lateral («fabricacion.pedidos» → /fabricacion).
*/
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

// Clave de la pestaña activa de un módulo, o null si esa pestaña no tiene
// burbuja (p. ej. Empleados > Asistencia).
export function tabKey(module, tab) {
  const key = `${module}.${tab}`;
  return ACTIVITY_KEYS.includes(key) ? key : null;
}
