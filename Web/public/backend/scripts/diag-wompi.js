// TEMPORAL — diagnóstico de Wompi desde esta computadora. Se borra después del diagnóstico.
// Uso (desde Web/public/backend):  node scripts/diag-wompi.js
// Lee el .env local; no imprime credenciales ni el token. No cobra ni tokeniza ninguna tarjeta.
import { runWompiDiag } from "../src/utils/wompiDiag.js";

const result = await runWompiDiag();
console.log(JSON.stringify(result, null, 2));
