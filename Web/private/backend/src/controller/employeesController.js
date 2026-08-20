const employeesController = {};

import employeeModel from "../models/Employee.js";
import bcryptjs from "bcryptjs";

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
      position,
      department,
      hourlyRate,
      hireDate,
    });
    await newEmployee.save();

    res.json({ message: "Employee saved" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
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
      dui,
      phone,
      email,
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
      returnDocument: "after",
    });

    res.json({ message: "Employee updated" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
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
