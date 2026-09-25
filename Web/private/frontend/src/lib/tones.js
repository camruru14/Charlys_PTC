/*
  Clases de color por tono para indicadores y chips que representan un
  concepto (no un estado de negocio: para eso está StatusPill). Todas salen de
  los tokens de index.css.
*/
export const TONE_DOT = {
  gray: "bg-tone-gray-dot",
  blue: "bg-tone-blue-dot",
  amber: "bg-tone-amber-dot",
  green: "bg-tone-green-dot",
  rose: "bg-tone-rose-dot",
  purple: "bg-tone-purple-dot",
  teal: "bg-tone-teal-dot",
  primary: "bg-primary",
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

export const TONE_SOFT = {
  gray: "bg-tone-gray text-tone-gray-text",
  blue: "bg-tone-blue text-tone-blue-text",
  amber: "bg-tone-amber text-tone-amber-text",
  green: "bg-tone-green text-tone-green-text",
  rose: "bg-tone-rose text-tone-rose-text",
  purple: "bg-tone-purple text-tone-purple-text",
  teal: "bg-tone-teal text-tone-teal-text",
};

// Paleta de gráficos en orden, como valores CSS utilizables en `style`.
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];
