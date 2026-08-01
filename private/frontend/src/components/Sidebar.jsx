import { NavLink } from "react-router-dom";
import { NAV_ITEMS, BOTTOM_ITEMS } from "../lib/nav";
import { IconLogout, IconPlus, IconClose } from "../lib/icons";
import { useAuth } from "../hooks/useAuth";

/*
  Menú lateral (Sidebar).
  - Fondo blanco, logotipo en texto azul.
  - Botón principal azul "+ Nuevo Lote".
  - Enlaces con iconos; el activo lleva texto azul y fondo azul muy tenue.
  - Abajo: Configuración, Cerrar Sesión y perfil de usuario.
  Es responsivo: en móvil se muestra como panel deslizable (controlado por `open`).
*/

function linkClass({ isActive }) {
  return [
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
    isActive
      ? "bg-brand-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

function Sidebar({ open, onClose, onNewBatch }) {
  const { user, logout } = useAuth();

  const displayName = user
    ? `${user.name || ""} ${user.lastName || ""}`.trim() || user.email
    : "Gabriel";
  const displayRole = user?.position || "Gerente general";

  return (
    <>
      {/* Overlay para móvil */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-300",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Logotipo */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white">
              IC
            </span>
            <span className="text-lg font-extrabold tracking-tight text-brand-700">
              Industrias Charly
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        {/* Botón principal */}
        <button
          type="button"
          onClick={onNewBatch}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
        >
          <IconPlus width={18} height={18} />
          Nuevo Lote
        </button>

        {/* Navegación */}
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Menú
          </p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={linkClass} onClick={onClose}>
              {({ isActive }) => (
                <>
                  <Icon
                    width={19}
                    height={19}
                    className={isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Zona inferior */}
        <div className="mt-4 space-y-1 border-t border-slate-100 pt-4">
          {BOTTOM_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
              {({ isActive }) => (
                <>
                  <Icon
                    width={19}
                    height={19}
                    className={isActive ? "text-brand-600" : "text-slate-400"}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <IconLogout width={19} height={19} className="text-slate-400" />
            Cerrar Sesión
          </button>

          {/* Perfil de usuario */}
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{displayRole}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
