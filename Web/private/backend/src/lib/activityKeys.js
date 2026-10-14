/*
  Claves de las pestañas que muestran burbujas de novedades. Cada clave es
  «módulo» o «módulo.pestaña». Su espejo en el panel web está en
  Web/private/frontend/src/lib/activityKeys.js: deben mantenerse iguales.
*/

// Clave de pestaña → módulo del menú (los nombres de lib/permissions.js).
export const KEY_MODULES = {
  pedidos: "Pedidos",
  "inventario.terminado": "Inventario",
  "inventario.materia": "Inventario",
  "inventario.pedidos": "Inventario",
  "fabricacion.lotes": "Fabricación",
  "fabricacion.diaria": "Fabricación",
  "fabricacion.pedidos": "Fabricación",
  "logistica.transito": "Logística",
  "logistica.despacho": "Logística",
  finanzas: "Finanzas",
  "empleados.personal": "Empleados",
};

export const ACTIVITY_KEYS = Object.keys(KEY_MODULES);

// Parte de la clave antes del punto: el módulo en la URL y en el menú
// («fabricacion.pedidos» → «fabricacion»).
export const moduleOfKey = (key) => key.split(".")[0];
