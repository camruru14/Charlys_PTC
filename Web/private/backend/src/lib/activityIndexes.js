import activityModel from "../models/Activity.js";
import activitySeenModel from "../models/ActivitySeen.js";

// Índices de las novedades. La primera versión de ActivitySeen tenía un índice
// único (employee, key): un solo «visto» por empleado y pestaña. Después los
// vistos pasaron a ser por registro, con el índice único (employee, key,
// entityId), pero Mongoose no borra los índices que ya no están en el esquema:
// el viejo sigue en la colección y hace chocar (E11000) el segundo documento del
// mismo empleado en una pestaña, así que los vistos por registro no se guardaban.
// Se elimina aquí. Es idempotente y solo toca esos índices; se corre al conectar
// a la base (database.js).
const LEGACY_INDEXES = ["employee_1_key_1"];

export async function ensureActivityIndexes(log = console.log) {
  const indexes = await activitySeenModel.collection.indexes().catch(() => []);
  for (const name of LEGACY_INDEXES) {
    if (indexes.some((index) => index.name === name)) {
      await activitySeenModel.collection.dropIndex(name);
      log(`Novedades: índice obsoleto ${name} eliminado`);
    }
  }
  await activitySeenModel.createIndexes();
  await activityModel.createIndexes();
}
