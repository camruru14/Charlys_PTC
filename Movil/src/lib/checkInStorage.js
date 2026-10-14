import * as SecureStore from "expo-secure-store";

// Entrada de «Mi asistencia» (AsistenciaScreen): la hora de «Marcar entrada» se
// guarda localmente hasta que se marca la salida, así sobrevive a que la app se
// cierre por completo antes de terminar el ciclo. Se guarda como
// { userId, at } porque el dispositivo puede cambiar de usuario: solo vale para
// el mismo usuario y mientras tenga menos de 16 horas (así un turno que cruza la
// medianoche todavía puede marcar su salida al día siguiente); cualquier otra entrada
// (de otro usuario, más vieja, futura o con el formato viejo, que era solo la hora) se
// ignora y se borra. También se borra al cerrar sesión (logout() en AuthContext), pero no
// cuando la sesión vence sola.
// (Mismas reglas de SecureStore que el token: solo alfanuméricos, «.», «-» y «_».)
const CHECKIN_KEY = "charly-attendance-checkin";
// Vigencia de una entrada sin salida.
const MAX_CHECKIN_AGE_MS = 16 * 60 * 60 * 1000;

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

// La entrada guardada de `userId` si tiene menos de 16 horas; si no, null (y se borra).
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
    const age = at ? Date.now() - at.getTime() : NaN;
    // age < 0: entrada «del futuro» (reloj cambiado): no es confiable.
    const valid = Boolean(at) && String(parsed.userId) === String(userId) && age >= 0 && age < MAX_CHECKIN_AGE_MS;
    if (valid) return at;
    await clearCheckIn();
    return null;
  } catch {
    return null;
  }
}
