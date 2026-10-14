import express from "express";
import employeesController from "../controller/employeesController.js";
import { requireAdminOrSelf, requireAdministrator, requireSelfOrModule } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Listar empleados lo puede hacer cualquier sesión (otras pantallas los usan
// para operarios y motoristas); crear y borrar, solo un administrador.
router
  .route("/")
  .get(employeesController.getEmployees)
  .post(requireAdministrator(), employeesController.insertEmployee);

// Editar: un administrador a cualquiera, y cada empleado solo su propia cuenta
// (sin tocar área, puesto, tarifa ni estado: el controlador lo valida).
router
  .route("/:id")
  .get(employeesController.getEmployee)
  .put(requireAdminOrSelf(), employeesController.updateEmployee)
  .delete(requireAdministrator(), employeesController.deleteEmployee);

// Contraseña en texto plano para el ojo del modal de editar (Personal y permisos):
// solo un administrador o el propio empleado.
router.route("/:id/password").get(requireAdminOrSelf(), employeesController.getPassword);

// Marcaciones de entrada/salida: el propio empleado (app móvil), un administrador
// o quien tenga el módulo Empleados.
router.route("/:id/attendance").post(requireSelfOrModule("Empleados"), employeesController.registerAttendance);

export default router;
