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
