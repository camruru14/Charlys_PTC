const authController = {};

import employeeModel from "../models/Employee.js";
import bcryptjs from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";

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

        res.cookie("authCookie", token, { httpOnly: true });
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

// LOGOUT
authController.logout = async (req, res) => {
  res.clearCookie("authCookie");
  res.json({ message: "Logout successful" });
};

export default authController;
