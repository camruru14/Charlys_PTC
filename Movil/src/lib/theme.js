// Tokens del sistema visual de Industrias Charly — mismos valores que el
// bloque @theme de Web/private/frontend/src/index.css, en camelCase
// (--color-ink-2 -> ink2, --color-tone-blue-text -> tones.blue.text), para
// que la app móvil se vea como el mismo sistema que el panel web. Ningún
// componente debería usar un hex suelto: todo color sale de acá.

// Tonos de estado: fondo / texto / punto. Mismos 7 que la web (ver
// lib/statusTones.js para el mapeo estado -> tono).
export const tones = {
  gray: { bg: "#EFF1F5", text: "#5C6579", dot: "#8A93A6" },
  blue: { bg: "#E9F0FB", text: "#2C5CA8", dot: "#4A7FD4" },
  amber: { bg: "#FAF1DF", text: "#8A5D15", dot: "#D9A441" },
  green: { bg: "#EAF4EE", text: "#367450", dot: "#5AA872" },
  rose: { bg: "#F8EDEF", text: "#9E4A5E", dot: "#C2697C" },
  purple: { bg: "#F1ECFA", text: "#6A4FA3", dot: "#8F74C9" },
  teal: { bg: "#E8F3F7", text: "#2C7189", dot: "#4E9CB5" },
};

export const TONE_NAMES = Object.keys(tones);

// Paleta de gráficos en orden (como CHART_COLORS de la web).
export const chartColors = ["#3D6FC9", "#C4841C", "#3C8F5E", "#7F5FC7", "#B85268"];

export const colors = {
  // Texto
  ink: "#16203A",
  ink2: "#4A5468",
  muted: "#657084",
  subtle: "#6A7387",
  faint: "#8A93A6",

  // Superficies y bordes
  canvas: "#F2F5FA",
  surface: "#FFFFFF",
  surface2: "#FAFBFD",
  line: "#E3E8F1",
  lineSoft: "#F0F3F8",
  navDivider: "#EEF1F6",

  // Acción principal
  primary: "#3168D4",
  primaryHover: "#2A5BBC",
  primarySoft: "#E9F0FB",
  primarySoftText: "#2C5CA8",
  primaryDisabled: "#C9D6F0",

  // Selección y filas destacadas
  selectBg: "#F3F7FD",
  selectBar: "#4A7FD4",
  rowAlert: "#FDF7F8",
  rowNew: "#F6FBF8",

  // Pastilla "ocupada" y flecha desplegable
  busy: "#F5F7FA",
  busyLine: "#D7DEE9",
  chevron: "#C3CBDA",

  // Fondo del control segmentado (solo de la app)
  segmentBg: "#E6EBF3",

  // Avisos ámbar (pedido incompleto en una ruta): borde y texto
  amberLine: "#EFD9AE",
  amberStrong: "#7A5413",

  // Gráficos
  chart1: chartColors[0],
  chart2: chartColors[1],
  chart3: chartColors[2],
  chart4: chartColors[3],
  chart5: chartColors[4],
  chartHistory: "#B9C6E0",
  chartRef: "#C3CBDA",
  chartGrid: "#F0F3F8",

  // Fondo oscurecido detrás de hojas y modales (ink al 38%)
  backdrop: "rgba(22, 32, 58, 0.38)",
  // Fondo oscurecido detrás del menú lateral (ink al 32%)
  drawerOverlay: "rgba(22, 32, 58, 0.32)",

  white: "#FFFFFF",

  tones,
};

// Paleta de un tono (bg / text / dot); gris si el nombre no existe.
export function getTone(name) {
  return tones[name] || tones.gray;
}

export default colors;
