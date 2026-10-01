// Cantidad máxima por línea de pedido. El backend (ordersController.js)
// aplica el mismo tope.
export const MAX_QUANTITY = 9_999_999;

const fmt = (n) => Number(n).toLocaleString("en-US");

// Valida el texto que el cliente tecleó como cantidad. Se llama al pulsar
// «Agregar» (no mientras escribe). `min` es product.minOrderQuantity.
// Devuelve { ok, value, message }: si es válida, value es el entero.
export function validateQuantity(text, min = 1) {
  const raw = String(text ?? "").trim();
  const value = /^\d+$/.test(raw) ? Number(raw) : 0;

  if (value === 0) {
    return { ok: false, value: null, message: "Cantidad no válida. Ingresa un número entero." };
  }
  if (value < min) {
    return {
      ok: false,
      value: null,
      message: `Cantidad no válida. La cantidad mínima es ${fmt(min)}.`,
    };
  }
  if (value > MAX_QUANTITY) {
    return {
      ok: false,
      value: null,
      message: `Cantidad no válida. La cantidad máxima es ${fmt(MAX_QUANTITY)}.`,
    };
  }
  return { ok: true, value, message: "" };
}
