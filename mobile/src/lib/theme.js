// Paleta de Industrias Charly — mismos valores que
// Web/private/frontend/src/index.css (@theme --color-brand-*, y el
// background/color de <body>), para que la app móvil se vea como el mismo
// sistema visual que el panel web y no como colores puestos a mano pantalla
// por pantalla. Cualquier hex nuevo en un componente debería salir de acá.
export const colors = {
  // Colores de marca
  brand50: "#eff6ff",
  brand100: "#dbeafe",
  brand200: "#bfdbfe",
  brand500: "#3b82f6",
  brand600: "#2563eb",
  brand700: "#1d4ed8",
  brand800: "#1e40af",

  // Fondo y texto base de la app (mismos valores que body{} en index.css)
  background: "#f6f8fb",
  text: "#0f172a",

  // Colores de estado (acentos sólidos: íconos, puntos, bordes)
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",

  // Versiones "suaves" (fondo pastel + texto oscuro) de los colores de
  // estado, para badges/chips/alertas — mismo criterio de tono suave que ya
  // usa el panel web (ej. clases Tailwind bg-emerald-50 text-emerald-700),
  // centralizado acá para que Badge/MiniButton/AlertCard no repitan cada uno
  // el mismo hex por su cuenta.
  successSoftBg: "#dcfce7",
  successSoftText: "#15803d",
  warningSoftBg: "#fef3c7",
  warningSoftText: "#b45309",
  dangerSoftBg: "#fee2e2",
  neutralSoftBg: "#f1f5f9",

  // Tonos extra (Fase 10), solo para el estado detallado de Pedidos —
  // amarillo/púrpura/celeste que no compartían pastel con success/warning/danger.
  yellowSoftBg: "#fef9c3",
  yellowSoftText: "#854d0e",
  purpleSoftBg: "#f3e8ff",
  purpleSoftText: "#7e22ce",
  skySoftBg: "#e0f2fe",
  skySoftText: "#0369a1",

  // Neutros de layout (bordes, texto secundario) — misma paleta "slate" que
  // ya usa el panel web vía clases Tailwind (bg-slate-*, text-slate-*). No
  // son colores de marca, pero sí necesarios para la jerarquía visual.
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate700: "#334155",

  white: "#ffffff",
};

export default colors;
