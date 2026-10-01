// Permisos INFORMATIVOS por área y puesto, copiados de
// Web/private/frontend/src/lib/permissions.js. Todavía no bloquean nada: el
// backend deja entrar a cualquier empleado activo a cualquier panel. Esta
// tabla solo describe a qué paneles tendría acceso cada empleado.
//
// Áreas: las del enum de Employee.department. El puesto es texto libre; se
// reconoce por palabras clave, sin importar mayúsculas, tildes ni género
// («Operario» / «Operaria»). Primero se busca una regla del puesto dentro del
// área; si ninguna coincide, se usa la regla general del área.

// Áreas del enum de Employee.department (backend).
export const DEPARTMENTS = ["Fabricación", "Logística", "Administración", "Almacén", "Finanzas"];

// Módulos del panel, en el orden del menú lateral.
export const MODULES = ["Dashboard", "Fabricación", "Inventario", "Pedidos", "Logística", "Finanzas", "Catálogo", "Empleados", "Configuración"];

export const PERMISSION_RULES = {
  Administración: {
    positions: [
      { match: ["administrador", "administradora", "gerente"], modules: "all", label: "Administrador / Gerente" },
      { match: ["ventas", "vendedor", "vendedora"], modules: ["Dashboard", "Pedidos", "Catálogo"], label: "Ventas" },
    ],
    modules: ["Dashboard", "Pedidos", "Catálogo", "Empleados"],
  },
  Fabricación: {
    positions: [
      { match: ["jefe", "jefa", "supervisor", "supervisora"], modules: ["Dashboard", "Fabricación", "Inventario", "Pedidos"], label: "Jefe / Supervisor" },
    ],
    modules: ["Fabricación"],
  },
  Almacén: {
    positions: [{ match: ["encargado", "encargada", "jefe", "jefa"], modules: ["Inventario", "Pedidos", "Logística"], label: "Encargado" }],
    modules: ["Inventario"],
  },
  Logística: {
    positions: [
      { match: ["jefe", "jefa", "coordinador", "coordinadora", "supervisor", "supervisora"], modules: ["Logística", "Pedidos", "Inventario"], label: "Jefe / Coordinador" },
    ],
    modules: ["Logística"],
  },
  Finanzas: {
    positions: [],
    modules: ["Dashboard", "Finanzas", "Pedidos"],
  },
};

const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Paneles de un empleado según su área y puesto: "all" o una lista de módulos.
export function employeeModules({ department, position } = {}) {
  const area = PERMISSION_RULES[department];
  if (!area) return [];
  const words = normalize(position).split(/[^a-z0-9]+/);
  const rule = area.positions.find((p) => p.match.some((m) => words.includes(normalize(m))));
  return rule ? rule.modules : area.modules;
}

// Texto para mostrar junto al empleado:
//   { scope: "global" | "exclusivo" | "parcial" | "ninguno", text }
export function permissionSummary(employee) {
  const modules = employeeModules(employee);
  if (modules === "all") return { scope: "global", text: "Acceso global · todos los paneles" };
  if (!modules.length) return { scope: "ninguno", text: "Sin área asignada: sin paneles" };
  if (modules.length === 1) return { scope: "exclusivo", text: `Acceso exclusivo · ${modules[0]}` };
  const list = `${modules.slice(0, -1).join(", ")} y ${modules[modules.length - 1]}`;
  return { scope: "parcial", text: `Acceso a ${list}` };
}

// --- Solo de la app -----------------------------------------------------------

// Tono de la pastilla de permiso (PermissionLine de la web).
export const SCOPE_TONE = { global: "green", exclusivo: "blue", parcial: "blue", ninguno: "gray" };

// «y» se vuelve «e» antes de una palabra que suena a «i» («Pedidos e Inventario»).
const joinWord = (next) => (/^h?i(?![aeou])/i.test(normalize(next)) ? "e" : "y");

// Texto corto para el chip de una fila: igual que permissionSummary, pero
// una lista larga se abrevia («Fabricación, Inventario y 2 más»).
export function permissionChip(employee) {
  const summary = permissionSummary(employee);
  if (summary.scope !== "parcial") return summary;
  const modules = employeeModules(employee);
  if (modules.length > 3) return { ...summary, text: `${modules.slice(0, 2).join(", ")} y ${modules.length - 2} más` };
  const last = modules[modules.length - 1];
  return { ...summary, text: `${modules.slice(0, -1).join(", ")} ${joinWord(last)} ${last}` };
}
