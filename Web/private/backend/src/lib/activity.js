import activityModel from "../models/Activity.js";
import { ACTIVITY_KEYS } from "./activityKeys.js";

/*
  Registra una novedad para las burbujas del menú y de las pestañas (ver
  models/Activity.js). Se llama DESPUÉS de que la acción se guardó bien; si
  la acción va en una transacción (withTransaction), se llama cuando ya se
  confirmó: registrar dentro de ella haría que un fallo del registro cancele
  también la acción, y justo eso no debe pasar.

    recordActivity({ keys: ["fabricacion.pedidos"], entityType: "order",
                     entityId: order._id, action: "sent-to-manufacturing",
                     actor: req.user?.id })

  `session` es opcional, por si algún día se necesita registrar dentro de una
  transacción. Si registrar falla, solo se escribe en el log: la acción ya
  ocurrió y no se tumba.
*/
export async function recordActivity({ keys, entityType, entityId, action, actor, session } = {}) {
  try {
    const list = [...new Set(keys || [])].filter((k) => ACTIVITY_KEYS.includes(k));
    if (!list.length || !entityId) return;
    await activityModel.create([{ keys: list, entityType, entityId, action, actor: actor || null, at: new Date() }], session ? { session } : {});
  } catch (error) {
    console.log(`error al registrar la actividad ${action || ""} de ${entityType}: ${error}`);
  }
}

/*
  Quita la clave `key` de las novedades de `entityId` (y borra las que se queden
  sin claves): el registro salió de esa pestaña (o se eliminó) y ya no hay nada que ver
  ahí; si no, la burbuja se quedaría pegada porque la fila ya no se puede abrir.
  Igual que recordActivity: se llama DESPUÉS del commit y, si falla, solo escribe en el
  log. `keys`: claves a quitar; `entityId` o `entityIds`: los registros.
*/
export async function resolveActivity({ keys, entityId, entityIds } = {}) {
  try {
    const list = [...new Set(keys || [])].filter((k) => ACTIVITY_KEYS.includes(k));
    const ids = [...new Set([...(entityIds || []), entityId].filter(Boolean).map(String))];
    if (!list.length || !ids.length) return;
    await activityModel.updateMany({ entityId: { $in: ids }, keys: { $in: list } }, { $pull: { keys: { $in: list } } });
    await activityModel.deleteMany({ entityId: { $in: ids }, keys: { $size: 0 } });
  } catch (error) {
    console.log(`error al resolver la actividad ${(keys || []).join(",")} de ${entityId || entityIds}: ${error}`);
  }
}

// Versión para un controlador: toma el empleado de la sesión (req.user.id).
export const recordFor = (req, activity) => recordActivity({ ...activity, actor: req.user?.id });

export default recordActivity;
