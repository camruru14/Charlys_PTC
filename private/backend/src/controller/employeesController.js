const employeesController = {};

import employeeModel from "../models/Employee.js";
import bcryptjs from "bcryptjs";

// SELECT - todos los empleados (sin exponer la contraseña)
employeesController.getEmployees = async (req, res) => {
  const employees = await employeeModel.find().select("-password");
  res.json(employees);
};

// SELECT - un empleado por id
employeesController.getEmployee = async (req, res) => {
  const employee = await employeeModel
    .findById(req.params.id)
    .select("-password");
  res.json(employee);
};

// INSERT
employeesController.insertEmployee = async (req, res) => {
  //#1- solicitar los datos
  const {
    name,
    lastName,
    dui,
    phone,
    email,
    password,
    role,
    position,
    department,
    hourlyRate,
    hireDate,
  } = req.body;

  //#2- Encriptar la contraseña antes de guardarla
  const passwordHash = await bcryptjs.hash(password, 10);

  //#3- Lleno mi modelo con esos datos que acabo de pedir
  const newEmployee = new employeeModel({
    name,
    lastName,
    dui,
    phone,
    email,
    password: passwordHash,
    role,
    position,
    department,
    hourlyRate,
    hireDate,
  });
  await newEmployee.save();

  res.json({ message: "Employee saved" });
};

// ACTUALIZAR
employeesController.updateEmployee = async (req, res) => {
  const {
    name,
    lastName,
    dui,
    phone,
    email,
    password,
    role,
    position,
    department,
    hourlyRate,
    isActive,
  } = req.body;

  const updateData = {
    name,
    lastName,
    dui,
    phone,
    email,
    role,
    position,
    department,
    hourlyRate,
    isActive,
  };

  // Solo re-encriptamos la contraseña si viene en la petición
  if (password) {
    updateData.password = await bcryptjs.hash(password, 10);
  }

  await employeeModel.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
  });

  res.json({ message: "Employee updated" });
};

//Eliminar
employeesController.deleteEmployee = async (req, res) => {
  await employeeModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Employee deleted" });
};

// Registrar una marcación (entrada/salida) proveniente de la app móvil
employeesController.registerAttendance = async (req, res) => {
  const { date, checkIn, checkOut, workedHours, overtimeHours } = req.body;

  await employeeModel.findByIdAndUpdate(
    req.params.id,
    { $push: { attendance: { date, checkIn, checkOut, workedHours, overtimeHours } } },
    { new: true },
  );

  res.json({ message: "Attendance registered" });
};

export default employeesController;
