import express from "express";
import employeesController from "../controller/employeesController.js";

const router = express.Router();

router
  .route("/")
  .get(employeesController.getEmployees)
  .post(employeesController.insertEmployee);

router
  .route("/:id")
  .get(employeesController.getEmployee)
  .put(employeesController.updateEmployee)
  .delete(employeesController.deleteEmployee);

// Contraseña en texto plano para el ojo del modal de editar (Personal y permisos)
router.route("/:id/password").get(employeesController.getPassword);

// Marcaciones de entrada/salida provenientes de la app móvil
router.route("/:id/attendance").post(employeesController.registerAttendance);

export default router;
