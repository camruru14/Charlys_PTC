import crypto from "node:crypto";
import bcryptjs from "bcryptjs";
import { config } from "../../config.js";

/*
  Contraseñas de empleados con encriptación REVERSIBLE (AES-256-GCM), para
  que el panel pueda mostrarlas con el ojo (Personal y permisos, Mi cuenta).
  Decisión temporal y consciente mientras no existan roles/permisos: hoy
  cualquier empleado con sesión podría pedirlas (ver GET /employees/:id/password).

  Formato guardado:  enc:v1:<iv base64>:<tag base64>:<texto cifrado base64>
  La llave (32 bytes, 64 caracteres hex) va en EMPLOYEE_PASSWORD_KEY del .env.
  Si se pierde, las contraseñas guardadas así ya no se pueden leer ni
  comprobar: hay que respaldarla junto con la base de datos.

  Los empleados antiguos siguen con su hash bcrypt ($2a$/$2b$/$2y$): el login
  lo compara con bcrypt y el panel dice que no se puede mostrar, hasta que se
  les asigne una contraseña nueva (que ya se guarda en el formato nuevo).
*/

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

export class PasswordKeyError extends Error {
  constructor() {
    super("Falta configurar EMPLOYEE_PASSWORD_KEY en el backend (64 caracteres hex) para guardar contraseñas.");
    this.name = "PasswordKeyError";
    this.status = 500;
  }
}

function getKey() {
  const hex = config.passwords.key || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new PasswordKeyError();
  return Buffer.from(hex, "hex");
}

export const isEncryptedPassword = (stored) => typeof stored === "string" && stored.startsWith(PREFIX);
export const isBcryptHash = (stored) => typeof stored === "string" && /^\$2[aby]\$\d{2}\$/.test(stored);

export function encryptPassword(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

// Texto plano de una contraseña en el formato nuevo; null si es un hash
// bcrypt viejo (irreversible) o si no se puede desencriptar.
export function decryptPassword(stored) {
  if (!isEncryptedPassword(stored)) return null;
  const [iv, tag, data] = stored.slice(PREFIX.length).split(":");
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof PasswordKeyError) throw error;
    return null; // llave distinta o valor dañado
  }
}

// ¿«plain» es la contraseña guardada? Formato nuevo: se desencripta y se
// compara; hash bcrypt viejo: bcrypt.compare.
export async function verifyPassword(plain, stored) {
  if (typeof plain !== "string" || !plain) return false;
  if (isEncryptedPassword(stored)) {
    const saved = decryptPassword(stored);
    if (saved == null) return false;
    const a = Buffer.from(plain, "utf8");
    const b = Buffer.from(saved, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (isBcryptHash(stored)) return bcryptjs.compare(plain, stored);
  return false;
}

// Lo que el panel puede mostrar: { password, legacy }.
//   password: texto plano (formato nuevo) o null.
//   legacy: true si es un hash bcrypt viejo que no se puede mostrar.
export function readablePassword(stored) {
  if (isEncryptedPassword(stored)) return { password: decryptPassword(stored), legacy: false };
  return { password: null, legacy: isBcryptHash(stored) };
}
