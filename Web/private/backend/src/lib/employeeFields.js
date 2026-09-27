// Validaciones compartidas de los datos de un empleado: las usan el CRUD de
// empleados (Configuración > Personal y permisos) y «Mi cuenta» (/auth/me).

export class FieldError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// DUI salvadoreño: se escribe «12345678-9» y se guarda como 9 dígitos sin
// guion (así están los registros existentes). Vacío = sin DUI.
export function normalizeDui(value) {
  if (value == null || value === "") return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 9) throw new FieldError("El DUI debe tener 9 números (ej. 12345678-9)");
  return digits;
}

export function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) throw new FieldError("Escribe un correo válido");
  return email;
}

export const MIN_PASSWORD_LENGTH = 6;

export function checkPassword(value) {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new FieldError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  return value;
}

// Respuesta de error común: validación (400), correo o DUI repetido (400) o 500.
export function sendEmployeeError(res, error) {
  if (error instanceof FieldError) return res.status(400).json({ message: error.message });
  if (error?.code === 11000) return res.status(400).json({ message: "Ya existe un empleado con ese correo" });
  if (error?.name === "ValidationError") return res.status(400).json({ message: Object.values(error.errors)[0]?.message || "Datos inválidos" });
  // Falta la llave de contraseñas (lib/passwordCrypto.js): el mensaje dice qué configurar.
  if (error?.name === "PasswordKeyError") {
    console.log("error " + error.message);
    return res.status(500).json({ message: error.message });
  }
  console.log("error " + error);
  return res.status(500).json({ message: "Error interno del servidor." });
}
