// Metadatos de las pantallas del menú lateral: mismo orden, etiquetas,
// íconos y subtítulos que Web/private/frontend/src/lib/nav.jsx, agrupados en
// las secciones de NAV_SECTIONS de components/Rail.jsx. `name` es el nombre
// de la ruta en DrawerNavigator; `icon` es un nombre de <Icon />.
export const NAV_ITEMS = {
  Dashboard: {
    label: "Dashboard",
    icon: "dashboard",
    subtitle: "Resumen global de producción, ventas y operaciones",
  },
  Fabricacion: {
    label: "Fabricación",
    icon: "factory",
    subtitle: "Control de líneas de producción y calidad",
  },
  Inventario: {
    label: "Inventario",
    icon: "box",
    subtitle: "Materia prima y stock de productos terminados",
  },
  Pedidos: {
    label: "Pedidos",
    icon: "orders",
    subtitle: "Pedidos provenientes de la tienda en línea",
  },
  Logistica: {
    label: "Logística",
    icon: "truck",
    subtitle: "Asignación de motoristas, vehículos y seguimiento de entregas",
  },
  Finanzas: {
    label: "Finanzas",
    icon: "finance",
    subtitle: "Ingresos, gastos, flujo de caja y rentabilidad",
  },
  Catalogo: {
    label: "Catálogo",
    icon: "tag",
    subtitle: "Productos, precios, colores e imágenes de la tienda en línea",
  },
  Empleados: {
    label: "Empleados",
    icon: "users",
    subtitle: "Asistencia, horas extra y planillas",
  },
  // Exclusiva del celular: no existe en nav.jsx de la web (ver
  // AsistenciaScreen.jsx) porque ahí RRHH captura la asistencia a
  // posteriori, en vez de que cada empleado marque su propia entrada/salida.
  // Su subtítulo es la fecha de hoy (ver DrawerNavigator).
  Asistencia: {
    label: "Mi asistencia",
    icon: "fingerprint",
  },
  Configuracion: {
    label: "Configuración",
    icon: "settings",
    subtitle: "Preferencias del sistema y de la cuenta",
  },
};

export const NAV_SECTIONS = [
  { title: "Operación", routes: ["Dashboard", "Fabricacion", "Inventario", "Pedidos", "Logistica"] },
  { title: "Negocio", routes: ["Finanzas", "Catalogo", "Empleados", "Asistencia"] },
  { title: "Sistema", routes: ["Configuracion"] },
];

// Encabezados de pantallas del Stack que no están en el menú (EXTRA_META de
// nav.jsx).
export const EXTRA_META = {
  HistorialLotes: {
    title: "Historial de lotes",
    subtitle: "Todos los lotes con búsqueda, filtros y rango de fechas",
  },
  HistorialTransacciones: {
    title: "Historial de transacciones",
    subtitle: "Todas las transacciones con búsqueda, filtros y rango de fechas",
  },
};

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "Viernes 25 de septiembre" (sin depender de Intl del motor JS).
export function todayLabel(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}
