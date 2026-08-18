import {
  IconDashboard,
  IconFactory,
  IconFinance,
  IconOrders,
  IconTruck,
  IconBox,
  IconUsers,
  IconSettings,
  IconTag,
} from "./icons";

export const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    icon: IconDashboard,
    title: "Dashboard",
    subtitle: "Resumen global de producción, ventas y operaciones",
  },
  {
    to: "/fabricacion",
    label: "Fabricación",
    icon: IconFactory,
    title: "Fabricación",
    subtitle: "Control de líneas de producción y calidad",
  },
  {
    to: "/finanzas",
    label: "Finanzas",
    icon: IconFinance,
    title: "Finanzas",
    subtitle: "Ingresos, gastos, flujo de caja y rentabilidad",
  },
  {
    to: "/pedidos",
    label: "Pedidos",
    icon: IconOrders,
    title: "Pedidos",
    subtitle: "Pedidos provenientes de la tienda en línea",
  },
  {
    to: "/logistica",
    label: "Logística",
    icon: IconTruck,
    title: "Logística — Gestión de Flotas",
    subtitle: "Asignación de motoristas, vehículos y seguimiento de entregas",
  },
  {
    to: "/inventario",
    label: "Inventario",
    icon: IconBox,
    title: "Inventario / Almacén",
    subtitle: "Materia prima y stock de productos terminados",
  },
  {
    to: "/catalogo",
    label: "Catálogo",
    icon: IconTag,
    title: "Catálogo — Tienda pública",
    subtitle: "Productos, precios, colores e imágenes de la tienda en línea",
  },
  {
    to: "/empleados",
    label: "Empleados",
    icon: IconUsers,
    title: "Empleados — RRHH",
    subtitle: "Asistencia, horas extra y planillas",
  },
];

export const BOTTOM_ITEMS = [
  {
    to: "/configuracion",
    label: "Configuración",
    icon: IconSettings,
    title: "Configuración",
    subtitle: "Preferencias del sistema y de la cuenta",
  },
];

// Encabezados de rutas que no aparecen en el menú lateral.
export const EXTRA_META = [
  {
    to: "/historial-lotes",
    title: "Historial de Lotes",
    subtitle: "Todos los lotes con búsqueda, filtros y rango de fechas",
  },
  {
    to: "/historial-transacciones",
    title: "Historial de Transacciones",
    subtitle: "Todas las transacciones con búsqueda, filtros y rango de fechas",
  },
];

// Devuelve el encabezado (title/subtitle) que corresponde a una ruta.
export function getPageMeta(pathname) {
  const all = [...NAV_ITEMS, ...BOTTOM_ITEMS, ...EXTRA_META];
  const match = all.find((item) => item.to === pathname);
  return match || { title: "Industrias Charly", subtitle: "Panel administrativo" };
}
