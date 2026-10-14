// Texto de una línea de pedido: el nombre exacto del producto del Catálogo y, si lo tiene, su
// tamaño aparte («Pajilla jumbo · Normal»). `color: true` agrega el color al final. También sirve
// para una línea del carrito (que guarda el nombre en `name`).
export function lineLabel(item, { color = false } = {}) {
  return [item?.product ?? item?.name, item?.size, color ? item?.color : null].filter(Boolean).join(" · ");
}
