import { config } from "../../config.js";
import wompiClient from "./wompiClient.js";

// Modos de pago (PAYMENTS_MODE, ver config.payments.mode y el README):
//   wompi: cobro real con Wompi (tokenización + cobro). Es el valor por defecto.
//   demo:  el pago se simula como aprobado al instante; NO se llama a Wompi en ningún paso.
//   auto:  Wompi con un presupuesto corto antes de cobrar; si autenticarse o tokenizar falla o no
//          responde a tiempo (todavía no se cobró nada), el pago se simula como en `demo`. Si el
//          COBRO falla no se simula: sigue la lógica de cobro sin confirmar (pendiente_conciliacion),
//          para no arriesgar un cobro doble.
//
// Presupuesto TOTAL (autenticación + tokenización juntas) del modo auto, sin reintentos.
export const AUTO_MODE_PRECHARGE_BUDGET_MS = 5000;
// Tiempo máximo del cobro en el modo auto.
export const AUTO_MODE_CHARGE_TIMEOUT_MS = 20000;

export const getPaymentsMode = () => config.payments.mode;

// Texto de una línea para el log de arranque.
export function describePaymentsMode(mode = getPaymentsMode()) {
  if (mode === "demo") return "Pagos: modo demo (no se cobra con Wompi)";
  if (mode === "auto") return `Pagos: modo auto (Wompi; si no responde antes del cobro, en ${AUTO_MODE_PRECHARGE_BUDGET_MS / 1000} s, se simula el pago)`;
  return "Pagos: modo wompi (cobro real con Wompi)";
}

// El pago simulado: lo único que cambia respecto a uno real es esta respuesta en lugar de la de Wompi.
// La tarjeta se ignora (nunca llega aquí) y no se guarda nada de ella.
function simulatedPayment(orderNumber) {
  return {
    approved: true,
    simulated: true,
    idTransaccion: `DEMO-${orderNumber}`,
    formaPago: "Demostración",
    codigoAutorizacion: undefined,
    mensaje: "Pago simulado (modo demostración)",
    cardLast4: undefined,
  };
}

// Falla de Wompi ANTES de cobrar que justifica simular en el modo auto: no respondió a tiempo, se cortó
// la red, devolvió un 5xx o rechazó nuestras credenciales/límites (502/504). Un 402 es Wompi diciendo que
// los datos de la tarjeta no sirven: es una respuesta real y se le muestra al cliente. `unconfirmed`
// (el cobro) nunca se simula.
const isWompiOutage = (error) => (error?.status === 502 || error?.status === 504) && !error.unconfirmed;

// Procesa el pago del checkout y devuelve:
//   { approved, simulated, idTransaccion, formaPago, codigoAutorizacion, mensaje, cardLast4 }
// `approved: false` es un rechazo de Wompi (el checkout responde 402 con `mensaje`). Los errores de
// Wompi se lanzan tal cual (status, mensaje y `unconfirmed` para el cobro).
// `onTokenized(cardLast4)` avisa en cuanto la tarjeta quedó tokenizada: si el cobro después queda sin
// confirmar, el checkout necesita esos 4 dígitos para el registro de conciliación.
export async function processPayment({ card, total, orderNumber, customerName, customerEmail, onTokenized }) {
  const mode = getPaymentsMode();
  if (mode === "demo") return simulatedPayment(orderNumber);

  const auto = mode === "auto";
  const startedAt = Date.now();

  let tokenizada;
  try {
    tokenizada = await wompiClient.tokenizeCard(
      {
        numeroTarjeta: card.number,
        cvv: card.cvv,
        mesVencimiento: card.month,
        anioVencimiento: card.year,
        nombreTarjetaHabiente: card.holderName,
      },
      auto ? { budgetMs: AUTO_MODE_PRECHARGE_BUDGET_MS } : {},
    );
  } catch (error) {
    if (!auto || !isWompiOutage(error)) throw error;
    console.warn(`Pagos: Wompi no respondió antes del cobro (${error.step || "tokenización"}, ${Date.now() - startedAt} ms); se simula el pago`);
    return simulatedPayment(orderNumber);
  }

  const cardLast4 = tokenizada.tarjetaEnmascarada?.trim().slice(-4);
  onTokenized?.(cardLast4);

  // La respuesta de Wompi (no lo que diga el navegador) es la única fuente de verdad sobre si el pago
  // se aprobó. Si el cobro falla NO se simula en ningún modo (el error sube al checkout).
  const cobro = await wompiClient.chargeTokenizedCard(
    {
      tokenTarjeta: tokenizada.token,
      monto: total,
      nombreCliente: customerName,
      emailCliente: customerEmail,
    },
    auto ? { timeoutMs: AUTO_MODE_CHARGE_TIMEOUT_MS } : {},
  );

  return {
    approved: Boolean(cobro.esAprobada),
    simulated: false,
    idTransaccion: cobro.idTransaccion,
    formaPago: cobro.formaPago,
    codigoAutorizacion: cobro.codigoAutorizacion,
    mensaje: cobro.mensaje,
    cardLast4,
  };
}
