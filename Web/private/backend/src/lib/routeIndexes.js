import routeModel from "../models/Route.js";

// Índices de las rutas. Antes había un índice único (date, number) porque el
// número se reiniciaba cada día; ahora las rutas se identifican con su código
// único (R-AAAA-NNNN) y ese índice haría chocar a la segunda ruta del mismo día
// (todas sin `number` propio), así que se elimina. Es idempotente y solo toca
// ese índice más el del código; se corre al conectar a la base (database.js).
const LEGACY_INDEX = "date_1_number_1";

export async function ensureRouteIndexes(log = console.log) {
  const indexes = await routeModel.collection.indexes().catch(() => []);
  if (indexes.some((index) => index.name === LEGACY_INDEX)) {
    await routeModel.collection.dropIndex(LEGACY_INDEX);
    log(`Rutas: índice obsoleto ${LEGACY_INDEX} eliminado`);
  }
  await routeModel.createIndexes();
}
