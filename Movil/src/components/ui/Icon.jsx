import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { colors } from "../../lib/theme";

// Íconos de línea portados de Web/private/frontend/src/lib/icons.jsx con los
// mismos trazos (viewBox 24, stroke 1.8, extremos redondeados), más algunos
// que solo usa la app (back, chevronRight, minus, fingerprint, grid, camera).
//   <Icon name="truck" size={20} color={colors.muted} />
// `color` hace de currentColor: trazo y, en "more", relleno de los puntos.
const ICONS = {
  dashboard: () => (
    <>
      <Rect x="3" y="3" width="7" height="9" rx="1.5" />
      <Rect x="14" y="3" width="7" height="5" rx="1.5" />
      <Rect x="14" y="12" width="7" height="9" rx="1.5" />
      <Rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  factory: () => (
    <>
      <Path d="M3 21h18" />
      <Path d="M4 21V9l6 4V9l6 4V6l4 2v13" />
      <Path d="M9 21v-4M14 21v-4" />
    </>
  ),
  finance: () => (
    <>
      <Path d="M3 3v18h18" />
      <Path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  orders: () => (
    <>
      <Path d="M6 2 3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4Z" />
      <Path d="M3 6h18" />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  truck: () => (
    <>
      <Path d="M1 3h13v13H1z" />
      <Path d="M14 8h4l3 3v5h-7" />
      <Circle cx="6" cy="18.5" r="2" />
      <Circle cx="17.5" cy="18.5" r="2" />
    </>
  ),
  // Bodega: nave con techo a dos aguas y estantes.
  warehouse: () => (
    <>
      <Path d="M3 21V8l9-5 9 5v13" />
      <Path d="M7 21v-9h10v9" />
      <Path d="M7 15h10M7 18h10" />
    </>
  ),
  box: () => (
    <>
      <Path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <Path d="M3 8l9 5 9-5" />
      <Path d="M12 13v8" />
    </>
  ),
  users: () => (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13A4 4 0 0 1 16 11" />
    </>
  ),
  trash: () => (
    <>
      <Path d="M3 6h18" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
    </>
  ),
  eye: () => (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: () => (
    <>
      <Path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6" />
      <Path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <Path d="M3 3l18 18" />
    </>
  ),
  user: () => (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  building: () => (
    <>
      <Path d="M3 21h18" />
      <Path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <Path d="M15 9h2a2 2 0 0 1 2 2v10" />
      <Path d="M9 7h2M9 11h2M9 15h2" />
    </>
  ),
  settings: () => (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  logout: () => (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </>
  ),
  search: () => (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  calendar: () => (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  plus: () => <Path d="M12 5v14M5 12h14" />,
  menu: () => <Path d="M4 6h16M4 12h16M4 18h16" />,
  close: () => <Path d="M18 6 6 18M6 6l12 12" />,
  alert: () => (
    <>
      <Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <Path d="M12 9v4M12 17h.01" />
    </>
  ),
  check: () => <Path d="M20 6 9 17l-5-5" />,
  chevronDown: () => <Path d="m6 9 6 6 6-6" />,
  tag: () => (
    <>
      <Path d="M12.59 2H6a2 2 0 0 0-2 2v6.59c0 .53.21 1.04.59 1.41l8.83 8.83a2 2 0 0 0 2.82 0l6.18-6.18a2 2 0 0 0 0-2.82l-8.83-8.83A2 2 0 0 0 12.59 2Z" />
      <Circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  image: () => (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="9" cy="9" r="1.5" />
      <Path d="m21 15-5-5L5 21" />
    </>
  ),
  more: (color) => (
    <>
      <Circle cx="5" cy="12" r="1.2" fill={color} />
      <Circle cx="12" cy="12" r="1.2" fill={color} />
      <Circle cx="19" cy="12" r="1.2" fill={color} />
    </>
  ),
  arrowUp: () => (
    <>
      <Path d="M12 19V5" />
      <Path d="m5 12 7-7 7 7" />
    </>
  ),
  dollar: () => (
    <>
      <Path d="M12 2v20" />
      <Path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  link: () => (
    <>
      <Path d="M15 3h6v6" />
      <Path d="M10 14 21 3" />
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  upload: () => (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="m17 8-5-5-5 5" />
      <Path d="M12 3v12" />
    </>
  ),
  edit: () => (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),

  // ---- Solo de la app ----
  back: () => <Path d="m15 18-6-6 6-6" />,
  chevronRight: () => <Path d="m9 18 6-6-6-6" />,
  minus: () => <Path d="M5 12h14" />,
  fingerprint: () => (
    <>
      <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <Path d="M2 12a10 10 0 0 1 18-6" />
      <Path d="M2 16h.01" />
      <Path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <Path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <Path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <Path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </>
  ),
  grid: () => (
    <>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  camera: () => (
    <>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <Circle cx="12" cy="13" r="3" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, size = 20, color = colors.ink, strokeWidth = 1.8, style }) {
  const render = ICONS[name];
  if (!render) {
    if (__DEV__) console.warn(`Icon: no existe el ícono "${name}"`);
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {render(color)}
      </G>
    </Svg>
  );
}
