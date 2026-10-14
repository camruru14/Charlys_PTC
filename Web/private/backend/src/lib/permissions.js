/*
  Quién es administrador. El panel no bloquea módulos por puesto (ver
  authMiddleware.js), pero las acciones delicadas, como eliminar un pedido,
  piden administrador. Se usa la misma tabla de Configuración > Personal y
  permisos (frontend/src/lib/permissions.js): es administrador quien tiene
  «Acceso global», es decir, el área Administración con puesto de
  Administrador/a o Gerente. También lo es quien conserva el campo heredado
  `role: "admin"` (ya no está en el esquema, pero la cuenta original lo tiene).
*/

import employeeModel from "../models/Employee.js";

const GLOBAL_POSITIONS = ["administrador", "administradora", "gerente"];

const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function isAdministrator(employee) {
  if (!employee) return false;
  if (employee.role === "admin") return true;
  if (employee.department !== "Administración") return false;
  const words = normalize(employee.position).split(/[^a-z0-9]+/);
  return GLOBAL_POSITIONS.some((p) => words.includes(p));
}

// ¿El empleado con ese id está activo y es administrador? (lean(): trae el
// campo heredado `role`, que Mongoose no devuelve al estar fuera del esquema.)
export async function isAdministratorId(id) {
  const employee = id ? await employeeModel.findById(id).lean() : null;
  return Boolean(employee?.isActive && isAdministrator(employee));
}

/*
  Módulos del panel a los que tiene acceso un empleado: la MISMA tabla
  informativa por área y puesto de Configuración > Personal y permisos
  (Web/private/frontend/src/lib/permissions.js, employeeModules): si una cambia,
  la otra también. Las burbujas de novedades (lib/activity.js) solo cuentan lo
  de estos módulos. Devuelve la lista de nombres de módulo («Fabricación»,
  «Pedidos»…); para quien tiene «Acceso global», todos los de MODULES.
*/
export const MODULES = ["Dashboard", "Fabricación", "Inventario", "Pedidos", "Logística", "Finanzas", "Catálogo", "Empleados", "Configuración"];

const PERMISSION_RULES = {
  Administración: {
    positions: [
      { match: GLOBAL_POSITIONS, modules: "all" },
      { match: ["ventas", "vendedor", "vendedora"], modules: ["Dashboard", "Pedidos", "Catálogo"] },
    ],
    modules: ["Dashboard", "Pedidos", "Catálogo", "Empleados"],
  },
  Fabricación: {
    positions: [{ match: ["jefe", "jefa", "supervisor", "supervisora"], modules: ["Dashboard", "Fabricación", "Inventario", "Pedidos"] }],
    modules: ["Fabricación"],
  },
  Almacén: {
    positions: [{ match: ["encargado", "encargada", "jefe", "jefa"], modules: ["Inventario", "Pedidos", "Logística"] }],
    modules: ["Inventario"],
  },
  Logística: {
    positions: [{ match: ["jefe", "jefa", "coordinador", "coordinadora", "supervisor", "supervisora"], modules: ["Logística", "Pedidos", "Inventario"] }],
    modules: ["Logística"],
  },
  Finanzas: {
    positions: [],
    modules: ["Dashboard", "Finanzas", "Pedidos"],
  },
};

export function employeeModules(employee) {
  if (!employee) return [];
  if (isAdministrator(employee)) return MODULES;
  const area = PERMISSION_RULES[employee.department];
  if (!area) return [];
  const words = normalize(employee.position).split(/[^a-z0-9]+/);
  const rule = area.positions.find((p) => p.match.some((m) => words.includes(normalize(m))));
  const modules = rule ? rule.modules : area.modules;
  return modules === "all" ? MODULES : modules;
}
