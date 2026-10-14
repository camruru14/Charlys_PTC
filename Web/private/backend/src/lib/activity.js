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

// Versión para un controlador: toma el empleado de la sesión (req.user.id).
export const recordFor = (req, activity) => recordActivity({ ...activity, actor: req.user?.id });

export default recordActivity;
