const employeesController = {};

import employeeModel from "../models/Employee.js";
import { FieldError, normalizeDui, normalizeEmail, sendEmployeeError } from "../lib/employeeFields.js";
import { decryptPassword, encryptPassword, isEncryptedPassword, readablePassword } from "../lib/passwordCrypto.js";

// SELECT - todos los empleados (sin exponer la contraseña)
employeesController.getEmployees = async (req, res) => {
  try {
    const employees = await employeeModel.find().select("-password");
    res.json(employees);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT - un empleado por id
employeesController.getEmployee = async (req, res) => {
  try {
    const employee = await employeeModel
      .findById(req.params.id)
      .select("-password");
    res.json(employee);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT - contraseña de un empleado en texto plano, para el ojo del modal de
// editar de Configuración > Personal y permisos (no va en la lista de
// empleados). { password, legacy }: legacy = hash bcrypt viejo que no se
// puede mostrar (ver lib/passwordCrypto.js). PENDIENTE: cuando existan los
// roles, solo el admin (o el propio empleado) podrá pedirla.
employeesController.getPassword = async (req, res) => {
  try {
    const employee = await employeeModel.findById(req.params.id).select("password");
    if (!employee) return res.status(404).json({ message: "Empleado no encontrado" });
    res.json(readablePassword(employee.password));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// INSERT
employeesController.insertEmployee = async (req, res) => {
  try {
    //#1- solicitar los datos
    const {
      name,
      lastName,
      dui,
      phone,
      email,
      password,
      position,
      department,
      hourlyRate,
      hireDate,
    } = req.body;

    if (!password) throw new FieldError("Escribe una contraseña para el empleado");

    //#2- Encriptar la contraseña antes de guardarla (reversible, AES-256-GCM)
    const encryptedPassword = encryptPassword(password);

    //#3- Lleno mi modelo con esos datos que acabo de pedir
    const newEmployee = new employeeModel({
      name,
      lastName,
      dui: normalizeDui(dui),
      phone,
      email: normalizeEmail(email),
      password: encryptedPassword,
      position,
      department,
      hourlyRate,
      hireDate,
    });
    await newEmployee.save();

    res.json({ message: "Employee saved" });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// ACTUALIZAR
employeesController.updateEmployee = async (req, res) => {
  try {
    const {
      name,
      lastName,
      dui,
      phone,
      email,
      password,
      position,
      department,
      hourlyRate,
      isActive,
    } = req.body;

    const updateData = {
      name,
      lastName,
      phone,
      position,
      department,
      hourlyRate,
      isActive,
    };
    // Solo se validan si vienen (la app móvil puede mandar un subconjunto).
    if (dui !== undefined) updateData.dui = normalizeDui(dui);
    if (email !== undefined) updateData.email = normalizeEmail(email);

    // Solo se cambia la contraseña si viene en la petición y es distinta de
    // la guardada: igual a la actual (el modal la precarga) o igual al valor
    // guardado tal cual (un cliente viejo que reenvía el hash) no cambia nada.
    if (password) {
      const current = (await employeeModel.findById(req.params.id).select("password"))?.password;
      const unchanged = password === current || (isEncryptedPassword(current) && decryptPassword(current) === password);
      if (!unchanged) updateData.password = encryptPassword(password);
    }

    await employeeModel.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    res.json({ message: "Employee updated" });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

//Eliminar
employeesController.deleteEmployee = async (req, res) => {
  try {
    await employeeModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Employee deleted" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Registrar una marcación (entrada/salida) proveniente de la app móvil
employeesController.registerAttendance = async (req, res) => {
  try {
    const { date, checkIn, checkOut, workedHours, overtimeHours } = req.body;

    await employeeModel.findByIdAndUpdate(
      req.params.id,
      { $push: { attendance: { date, checkIn, checkOut, workedHours, overtimeHours } } },
      { returnDocument: "after" },
    );

    res.json({ message: "Attendance registered" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default employeesController;
