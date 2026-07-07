import { useLocation } from "react-router-dom";
import { IconSearch, IconDownload, IconMenu, IconBell } from "../lib/icons";
import DateRangePicker from "./ui/DateRangePicker";

/*
  Encabezado (Top Bar).
  - Título grande en negrita + subtítulo gris descriptivo.
  - A la derecha: búsqueda, selector de fechas y botón "Descargar Reporte".
  - El selector de fechas solo aparece en las vistas con analítica por fecha:
    Dashboard, Finanzas e Historial de Lotes.
*/

// Rutas donde el filtro por fechas está disponible
const DATE_ROUTES = ["/", "/finanzas", "/historial-lotes", "/historial-transacciones"];

function TopBar({ title, subtitle, onOpenMenu }) {
  const location = useLocation();
  const showDatePicker = DATE_ROUTES.includes(location.pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f6f8fb]/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 lg:hidden"
          >
            <IconMenu width={20} height={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Búsqueda global */}
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <IconSearch
              width={18}
              height={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-56"
            />
          </div>

          {/* Selector de fechas (solo en rutas con analítica) */}
          {showDatePicker ? <DateRangePicker /> : null}

          {/* Notificaciones */}
          <button
            type="button"
            className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:border-slate-300"
          >
            <IconBell width={18} height={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Descargar Reporte */}
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <IconDownload width={18} height={18} className="text-slate-500" />
            <span className="hidden sm:inline">Descargar Reporte</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
