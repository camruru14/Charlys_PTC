// Validaciones de texto compartidas por los controladores de la tienda: todo lo que
// llega del navegador se comprueba aquí ANTES de usarlo (y, en el checkout, antes de cobrar).

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.expose = true;
  }
}

// Texto opcional: undefined/null/"" → undefined; si viene, tiene que ser string de hasta `max` caracteres.
export function optionalText(value, max, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ValidationError(`${label} no es válido.`);
  const text = value.trim();
  if (text.length > max) throw new ValidationError(`${label} no puede pasar de ${max} caracteres.`);
  return text || undefined;
}

// Texto obligatorio de hasta `max` caracteres.
export function requiredText(value, max, label) {
  const text = optionalText(value, max, label);
  if (!text) throw new ValidationError(`${label} es obligatorio.`);
  return text;
}

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt solo lee los primeros 72 bytes: más largo no aporta seguridad.
export const MAX_PASSWORD_LENGTH = 72;

export function checkNewPassword(value, label = "La contraseña") {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`${label} debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`${label} no puede pasar de ${MAX_PASSWORD_LENGTH} caracteres.`);
  }
  return value;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Correo normalizado (minúsculas, sin espacios) o undefined si no es un correo.
export function normalizeEmailOrNull(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}
