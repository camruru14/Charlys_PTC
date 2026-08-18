/*
  Opciones del catálogo de la tienda pública (public/backend + public/frontend).
  El nombre del producto se escribe a mano en el formulario (no hay una lista
  fija de variantes), pero los colores sí son un catálogo cerrado — de ahí
  sale la fuente única de verdad para que el formulario de administración
  (pages/Catalogo.jsx) y la tienda pública muestren siempre las mismas
  opciones sin repetirlas a mano en cada archivo.

  IMPORTANTE: public/frontend es una app separada (no puede importar este
  archivo) y tiene su propia copia idéntica en
  public/frontend/src/lib/catalogOptions.js, para que las cards y el detalle
  de producto muestren siempre las mismas opciones que este panel. Si esta
  lista cambia, actualiza también esa copia.
*/

// Mismos colores que ya maneja Inventario en el panel privado.
export const PRODUCT_COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

// Para pintar un puntito de color junto al nombre (checkboxes del
// formulario, chips en las cards de administración y de /productos).
export const PRODUCT_COLOR_HEX = {
  Rojo: "#ef4444",
  Azul: "#3b82f6",
  Verde: "#22c55e",
  Blanco: "#f8fafc",
  Negro: "#0f172a",
  Amarillo: "#eab308",
};
