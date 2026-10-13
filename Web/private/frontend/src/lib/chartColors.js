/*
  Colores de las gráficas del Dashboard (components/charts). Las series llevan su color; los textos
  y ejes de las gráficas usan siempre los colores de texto del sistema (fill-ink, fill-subtle…),
  nunca el de la serie.
*/
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
