import * as SecureStore from "expo-secure-store";
import { dayKey } from "./attendance";

// Entrada de «Mi asistencia» (AsistenciaScreen): la hora de «Marcar entrada» se
// guarda localmente hasta que se marca la salida, así sobrevive a que la app se
// cierre por completo antes de terminar el ciclo. Se guarda como
// { userId, at } porque el dispositivo puede cambiar de usuario: solo vale para
// el mismo usuario y el mismo día; cualquier otra entrada (de otro usuario, de otro
// día o con el formato viejo, que era solo la hora) se ignora y se borra. También
// se borra al cerrar sesión (AuthContext).
// (Mismas reglas de SecureStore que el token: solo alfanuméricos, «.», «-» y «_».)
const CHECKIN_KEY = "charly-attendance-checkin";

export async function clearCheckIn() {
  try {
    await SecureStore.deleteItemAsync(CHECKIN_KEY);
  } catch {
    // Sin acceso al almacén: no hay nada que borrar.
  }
}

export async function saveCheckIn(userId, at) {
  await SecureStore.setItemAsync(CHECKIN_KEY, JSON.stringify({ userId: String(userId), at: at.toISOString() }));
}

// La entrada guardada de `userId` si es de hoy; si no, null (y se borra).
export async function readCheckIn(userId) {
  // Sin usuario todavía no se puede saber de quién es: no se toca nada.
  if (!userId) return null;
  try {
    const stored = await SecureStore.getItemAsync(CHECKIN_KEY);
    if (!stored) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
    const at = parsed?.at ? new Date(parsed.at) : null;
    const valid =
      at && !Number.isNaN(at.getTime()) && String(parsed.userId) === String(userId) && dayKey(at) === dayKey(new Date());
    if (valid) return at;
    await clearCheckIn();
    return null;
  } catch {
    return null;
  }
}
