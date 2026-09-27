const authController = {};

import employeeModel from "../models/Employee.js";
import bcryptjs from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";
import { checkPassword, normalizeDui, normalizeEmail, sendEmployeeError } from "../lib/employeeFields.js";

// LOGIN del panel administrativo (empleados)
authController.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    //#1- Buscar el empleado por su correo
    const employeeFound = await employeeModel.findOne({ email });

    if (!employeeFound) {
      return res.status(404).json({ message: "Employee not found" });
    }

    //#2- Comprobar que el empleado esté activo
    if (!employeeFound.isActive) {
      return res.status(403).json({ message: "Employee is not active" });
    }

    //#3- Validar la contraseña
    const isMatch = await bcryptjs.compare(password, employeeFound.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    //#4- Generar el token de sesión (el sistema ya no maneja roles/permisos:
    // cualquier empleado autenticado puede usar cualquier ruta, ver authMiddleware.js)
    jsonwebtoken.sign(
      { id: employeeFound._id },
      config.JWT.secret,
      (error, token) => {
        if (error) console.log("error" + error);

        const isProduction = process.env.NODE_ENV === "production";
        res.cookie("authCookie", token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
        });
        res.json({
          message: "Login successful",
          // El panel web sigue usando la cookie httpOnly; el token también
          // va en el cuerpo para clientes que no pueden usar cookies
          // (la app móvil, que lo manda como header Authorization: Bearer).
          token,
          user: {
            id: employeeFound._id,
            name: employeeFound.name,
            lastName: employeeFound.lastName,
            email: employeeFound.email,
            position: employeeFound.position,
          },
        });
      },
    );
  } catch (error) {
    console.log("error" + error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---- Mi cuenta: datos del empleado que tiene la sesión abierta (req.user.id,
// ver authMiddleware.js). Para editar a OTRO empleado está /employees/:id
// (Configuración > Personal y permisos).

const toAccount = (e) => ({
  id: e._id,
  name: e.name,
  lastName: e.lastName,
  email: e.email,
  phone: e.phone || "",
  dui: e.dui || "",
  position: e.position || "",
  department: e.department || "",
});

async function findSessionEmployee(req, res) {
  const employee = await employeeModel.findById(req.user?.id);
  if (!employee || !employee.isActive) {
    res.status(404).json({ message: "No se encontró tu cuenta" });
    return null;
  }
  return employee;
}

// GET /auth/me
authController.getMe = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (employee) res.json(toAccount(employee));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// PUT /auth/me { phone, dui }: datos que no piden contraseña.
authController.updateMe = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;
    employee.phone = typeof req.body.phone === "string" ? req.body.phone.trim() : employee.phone;
    if (req.body.dui !== undefined) employee.dui = normalizeDui(req.body.dui);
    await employee.save();
    res.json(toAccount(employee));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// PUT /auth/me/credentials { currentPassword, email?, newPassword? }:
// cambiar el correo (con el que se inicia sesión) o la contraseña siempre
// pide la contraseña actual.
authController.updateCredentials = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;

    const { currentPassword, email, newPassword } = req.body;
    if (!currentPassword || !(await bcryptjs.compare(currentPassword, employee.password))) {
      return res.status(400).json({ message: "La contraseña actual no es correcta" });
    }

    const nextEmail = email !== undefined && email !== "" ? normalizeEmail(email) : employee.email;
    if (nextEmail === employee.email && !newPassword) {
      return res.status(400).json({ message: "No hay cambios que guardar" });
    }
    employee.email = nextEmail;
    if (newPassword) employee.password = await bcryptjs.hash(checkPassword(newPassword), 10);
    await employee.save();
    res.json(toAccount(employee));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// LOGOUT
authController.logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("authCookie", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  res.json({ message: "Logout successful" });
};

export default authController;
