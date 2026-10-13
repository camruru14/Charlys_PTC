// Colores de las gráficas del Dashboard (components/dashboard) — mismos valores que
// Web/private/frontend/src/lib/chartColors.js. Los textos y ejes usan siempre los colores de
// texto del tema (lib/theme.js), nunca el de la serie.
export const SERIES_COLORS = {
  sales: "#2a78d6", // ventas / ingresos
  expense: "#eb6834", // gastos
  positive: "#1baf7a",
  warn: "#eda100",
  negative: "#e0527a",
};

// Colores categóricos en orden fijo (dona de ventas por producto) y el gris de «Otros».
export const CATEGORICAL_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
export const OTHERS_COLOR = "#9aa3b5";
