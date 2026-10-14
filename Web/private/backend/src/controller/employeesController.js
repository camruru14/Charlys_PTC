const employeesController = {};

import mongoose from "mongoose";
import employeeModel from "../models/Employee.js";
import { FieldError, checkPassword, normalizeDui, normalizeEmail, normalizeName, sendEmployeeError } from "../lib/employeeFields.js";
import cloudinary from "../lib/cloudinary.js";
import { recordFor, resolveActivity } from "../lib/activity.js";
import { decryptPassword, encryptPassword, isEncryptedPassword, readablePassword } from "../lib/passwordCrypto.js";
import { isAdministrator, isAdministratorId } from "../lib/permissions.js";
import { setSessionCookie, signSessionToken } from "../lib/session.js";

/*
  Quién puede qué (las rutas lo exigen en routes/employees.js):
   - administrador (lib/permissions.js): ve la contraseña de cualquiera y crea,
     edita como quiera, desactiva y elimina empleados;
   - el propio empleado: solo ve y edita su cuenta, y NO puede cambiarse área,
     puesto, tarifa ni estado (con eso podría hacerse administrador); su correo
     y su contraseña se cambian en Mi cuenta (/auth/me/credentials), que pide la
     contraseña actual;
   - cualquier otro: solo lista empleados (otras pantallas los usan para operarios
     y motoristas) y, con el módulo Empleados, registra marcaciones.
*/

const ADMIN_REQUIRED = "Debe quedar al menos un administrador activo";

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw new FieldError("Identificador inválido");
}

// Tarifa por hora: vacía = sin cambio; si viene, un número que no sea negativo.
function parseHourlyRate(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const rate = typeof value === "boolean" ? NaN : Number(value);
  if (!Number.isFinite(rate) || rate < 0) throw new FieldError("La tarifa por hora no puede ser negativa");
  return rate;
}

const cleanText = (value) => (typeof value === "string" ? value.trim() : undefined);

// ¿Cuántos administradores ACTIVOS hay además de `id`? (cuenta también el campo heredado role)
async function otherActiveAdmins(id) {
  const others = await employeeModel.find({ isActive: true, _id: { $ne: id } }).select("department position role").lean();
  return others.filter(isAdministrator).length;
}

// SELECT - todos los empleados (sin exponer la contraseña)
employeesController.getEmployees = async (req, res) => {
  try {
    const employees = await employeeModel.find().select("-password -tokenVersion");
    res.json(employees);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT - un empleado por id
employeesController.getEmployee = async (req, res) => {
  try {
    checkId(req.params.id);
    const employee = await employeeModel
      .findById(req.params.id)
      .select("-password -tokenVersion");
    if (!employee) return res.status(404).json({ message: "Empleado no encontrado" });
    res.json(employee);
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// SELECT - contraseña de un empleado en texto plano, para el ojo del modal de
// editar de Configuración > Personal y permisos (no va en la lista de
// empleados). { password, legacy }: legacy = hash bcrypt viejo que no se
// puede mostrar (ver lib/passwordCrypto.js). La ruta solo deja pasar a un
// administrador o al propio empleado.
employeesController.getPassword = async (req, res) => {
  try {
    checkId(req.params.id);
    const employee = await employeeModel.findById(req.params.id).select("password");
    if (!employee) return res.status(404).json({ message: "Empleado no encontrado" });
    res.json(readablePassword(employee.password));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// INSERT (solo administrador)
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
    } = req.body ?? {};

    if (typeof password !== "string" || !password) throw new FieldError("Escribe una contraseña para el empleado");
    checkPassword(password);

    //#2- Encriptar la contraseña antes de guardarla (reversible, AES-256-GCM)
    const encryptedPassword = encryptPassword(password);

    //#3- Lleno mi modelo con esos datos que acabo de pedir
    const newEmployee = new employeeModel({
      name: normalizeName(name, "el nombre"),
      lastName: normalizeName(lastName, "el apellido"),
      dui: normalizeDui(dui),
      phone: cleanText(phone),
      email: normalizeEmail(email),
      password: encryptedPassword,
      position: cleanText(position),
      department,
      hourlyRate: parseHourlyRate(hourlyRate),
      hireDate,
    });
    await newEmployee.save();
    await recordFor(req, { keys: ["empleados.personal"], entityType: "employee", entityId: newEmployee._id, action: "created" });

    res.json({ message: "Employee saved" });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// ACTUALIZAR (un administrador a cualquiera; el propio empleado, solo sus datos personales)
employeesController.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    checkId(id);
    const body = req.body ?? {};
    const target = await employeeModel.findById(id).lean();
    if (!target) return res.status(404).json({ message: "Empleado no encontrado" });
    const isAdmin = await isAdministratorId(req.user.id);

    const updateData = {};
    if (body.name !== undefined) updateData.name = normalizeName(body.name, "el nombre");
    if (body.lastName !== undefined) updateData.lastName = normalizeName(body.lastName, "el apellido");
    const phone = cleanText(body.phone);
    if (phone !== undefined) updateData.phone = phone;
    // Solo se validan si vienen (la app móvil puede mandar un subconjunto).
    if (body.dui !== undefined) updateData.dui = normalizeDui(body.dui);
    if (body.email !== undefined) updateData.email = normalizeEmail(body.email);
    const position = cleanText(body.position);
    if (position !== undefined) updateData.position = position;
    if (body.department !== undefined) updateData.department = body.department;
    const hourlyRate = parseHourlyRate(body.hourlyRate);
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new FieldError("El estado de la cuenta no es válido");
      updateData.isActive = body.isActive;
    }

    // Solo se cambia la contraseña si viene en la petición y es distinta de
    // la guardada: igual a la actual (el modal la precarga) o igual al valor
    // guardado tal cual (un cliente viejo que reenvía el hash) no cambia nada.
    let passwordChanged = false;
    if (typeof body.password === "string" && body.password) {
      const current = target.password;
      const unchanged = body.password === current || (isEncryptedPassword(current) && decryptPassword(current) === body.password);
      if (!unchanged) {
        updateData.password = encryptPassword(checkPassword(body.password));
        passwordChanged = true;
      }
    }

    if (!isAdmin) {
      // El propio empleado: su correo y su contraseña se cambian en Mi cuenta, que pide la contraseña actual.
      if ((updateData.email !== undefined && updateData.email !== target.email) || passwordChanged) {
        return res.status(403).json({ message: "Para cambiar tu correo o tu contraseña usa Configuración › Mi cuenta", code: "ACCOUNT_FORBIDDEN" });
      }
      // Área, puesto, tarifa y estado: con eso podría hacerse administrador.
      const differs =
        (updateData.department !== undefined && updateData.department !== target.department) ||
        (updateData.position !== undefined && updateData.position !== (target.position || "")) ||
        (updateData.hourlyRate !== undefined && updateData.hourlyRate !== (target.hourlyRate ?? 0)) ||
        (updateData.isActive !== undefined && updateData.isActive !== target.isActive);
      if (differs) {
        return res.status(403).json({ message: "Solo un administrador puede cambiar el área, el puesto, la tarifa o el estado de una cuenta", code: "ADMIN_ONLY" });
      }
      ["department", "position", "hourlyRate", "isActive"].forEach((field) => delete updateData[field]);
    }

    // Siempre debe quedar un administrador activo: nadie puede quitarse el acceso
    // global (área o puesto) ni desactivarse si es el único.
    const after = { ...target, ...updateData };
    if (target.isActive && isAdministrator(target) && !(after.isActive && isAdministrator(after)) && (await otherActiveAdmins(id)) === 0) {
      return res.status(409).json({ message: ADMIN_REQUIRED });
    }

    // Cambiar la contraseña o desactivar la cuenta cierra sus sesiones abiertas.
    const revoke = passwordChanged || (updateData.isActive === false && target.isActive !== false);
    const updated = await employeeModel.findByIdAndUpdate(
      id,
      { $set: updateData, ...(revoke ? { $inc: { tokenVersion: 1 } } : {}) },
      { returnDocument: "after", runValidators: true },
    );

    const result = { message: "Employee updated" };
    if (revoke && String(id) === String(req.user.id) && updated?.isActive) {
      // Quien cambia su propia contraseña conserva SU sesión con un token nuevo.
      result.token = signSessionToken(updated);
      setSessionCookie(res, result.token);
    }
    res.json(result);
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

//Eliminar (solo administrador)
employeesController.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    checkId(id);
    const target = await employeeModel.findById(id).lean();
    if (!target) return res.status(404).json({ message: "Empleado no encontrado" });
    if (target.isActive && isAdministrator(target) && (await otherActiveAdmins(id)) === 0) {
      return res.status(409).json({ message: ADMIN_REQUIRED });
    }
    await employeeModel.findByIdAndDelete(id);
    await resolveActivity({ keys: ["empleados.personal"], entityId: id });
    // Su foto de perfil no debe quedar huérfana en Cloudinary.
    if (target.photo?.publicId) await cloudinary.uploader.destroy(target.photo.publicId).catch(() => null);
    res.json({ message: "Employee deleted" });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

function toDate(value, label) {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new FieldError(`${label} no es una fecha válida`);
  return date;
}

// Horas de una jornada: un número entre 0 y 24 (sin valor = 0).
function toHours(value, label) {
  if (value === undefined || value === null || value === "") return 0;
  const hours = typeof value === "boolean" ? NaN : Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new FieldError(`${label} debe ser un número entre 0 y 24`);
  return hours;
}

// Registrar una marcación (entrada/salida) proveniente de la app móvil o del panel
employeesController.registerAttendance = async (req, res) => {
  try {
    checkId(req.params.id);
    const body = req.body ?? {};
    const date = toDate(body.date, "La fecha");
    const checkIn = toDate(body.checkIn, "La hora de entrada");
    const checkOut = toDate(body.checkOut, "La hora de salida");
    if (checkOut <= checkIn) throw new FieldError("La salida debe ser después de la entrada");
    const workedHours = toHours(body.workedHours, "Las horas trabajadas");
    const overtimeHours = toHours(body.overtimeHours, "Las horas extra");

    const updated = await employeeModel
      .findByIdAndUpdate(
        req.params.id,
        { $push: { attendance: { date, checkIn, checkOut, workedHours, overtimeHours } } },
        { returnDocument: "after", runValidators: true },
      )
      .select("_id");
    if (!updated) return res.status(404).json({ message: "Empleado no encontrado" });

    res.json({ message: "Attendance registered" });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

export default employeesController;
