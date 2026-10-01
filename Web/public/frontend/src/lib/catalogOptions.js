/*
  Opciones del catálogo de la tienda: colores disponibles. Se usan para
  pintar los chips de color en ProductCard y en el selector de color de
  ProductoDetallePage.

  IMPORTANTE: este archivo es una copia idéntica de
  private/frontend/src/lib/catalogOptions.js — de ahí sale el formulario de
  administración de productos (pages/Catalogo.jsx). Son dos apps separadas y
  no pueden importar un mismo archivo; si esta lista cambia, actualiza
  también la copia del panel privado.
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
