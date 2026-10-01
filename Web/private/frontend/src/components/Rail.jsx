import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS, BOTTOM_ITEMS } from "../lib/nav";
import { IconClose, IconLogout } from "../lib/icons";
import { useAuth } from "../hooks/useAuth";

/*
  Navegación del panel.
  - >= 1024px: menú lateral blanco de 200px con secciones (Rail).
  - <  1024px: cajón deslizable con etiquetas (Drawer), que abre el botón de
    menú del PageHeader.
*/

// Secciones del menú lateral: agrupan por ruta los módulos de nav.js.
const NAV_SECTIONS = [
  { title: "Operación", paths: ["/", "/fabricacion", "/inventario", "/pedidos", "/logistica"] },
  { title: "Negocio", paths: ["/finanzas", "/catalogo", "/empleados"] },
  { title: "Sistema", paths: ["/configuracion"] },
];

const ALL_ITEMS = [...NAV_ITEMS, ...BOTTOM_ITEMS];
const sections = NAV_SECTIONS.map(({ title, paths }) => ({
  title,
  items: paths.map((p) => ALL_ITEMS.find((item) => item.to === p)).filter(Boolean),
}));

function useUserInfo() {
  const { user, logout } = useAuth();
  const name = user ? `${user.name || ""} ${user.lastName || ""}`.trim() || user.email : "Usuario";
  const role = user?.position || user?.department || "";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "IC";
  return { name, role, initials, logout };
}

function RailLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={label}
      className={({ isActive }) =>
        `group relative flex h-[38px] items-center gap-2.5 px-4 text-[13.5px] transition focus-visible:bg-surface-2 focus-visible:outline-none ${
          isActive ? "font-bold text-ink" : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-[3px] bg-primary" aria-hidden="true" />
          ) : null}
          <Icon
            width={17}
            height={17}
            strokeWidth={1.8}
            className={`shrink-0 ${isActive ? "text-primary-soft-text" : "text-faint group-hover:text-ink-2"}`}
          />
          <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function AvatarMenu() {
  const { name, role, initials, logout } = useUserInfo();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative px-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={name}
        aria-label={`Cuenta de ${name}`}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1 text-left transition hover:bg-surface-2"
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11.5px] font-extrabold text-primary-soft-text">
          {initials}
        </span>
        <span className="min-w-0 truncate whitespace-nowrap text-[12.5px] font-bold text-ink">{name}</span>
      </button>
      {open ? (
        <div className="absolute bottom-full left-2 right-2 z-50 mb-2 rounded-[12px] border border-line bg-surface p-1.5 shadow-modal">
          <div className="border-b border-line-soft px-2.5 py-2">
            <p className="truncate text-[13.5px] font-semibold text-ink">{name}</p>
            {role ? <p className="t-aux truncate">{role}</p> : null}
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold text-ink-2 transition hover:bg-tone-rose hover:text-tone-rose-text"
          >
            <IconLogout width={16} height={16} />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Rail() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[200px] flex-col border-r border-line bg-surface py-[22px] lg:flex">
      <div className="mb-[18px] flex items-center gap-[9px] px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[12.5px] font-extrabold text-white">
          IC
        </span>
        <span className="min-w-0 truncate whitespace-nowrap text-[14.5px] font-extrabold text-ink">Ind. Charly</span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Módulos">
        {sections.map(({ title, items }) => (
          <div key={title} role="group" aria-label={title}>
            <p className="px-4 pt-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-faint">{title}</p>
            {items.map((item) => (
              <RailLink key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="shrink-0">
        <div className="mx-4 mt-1.5 mb-3 h-px bg-nav-divider" />
        <AvatarMenu />
      </div>
    </aside>
  );
}

export function Drawer({ open, onClose }) {
  const { name, role, initials, logout } = useUserInfo();

  const linkClass = ({ isActive }) =>
    `flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-semibold transition ${
      isActive ? "bg-rail-active text-white" : "text-rail-icon hover:bg-white/8 hover:text-white"
    }`;

  return (
    <div className="lg:hidden">
      {open ? <div className="fixed inset-0 z-30 bg-ink/32" onClick={onClose} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-rail px-3 py-5 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-[13px] font-extrabold text-white">
              IC
            </span>
            <span className="text-[15px] font-bold text-white">Industrias Charly</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="rounded-[8px] p-1.5 text-rail-icon hover:text-white">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {[...NAV_ITEMS, ...BOTTOM_ITEMS].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={linkClass} onClick={onClose}>
              <Icon width={19} height={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/16 pt-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rail-active text-[12.5px] font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{name}</p>
              {role ? <p className="truncate text-[11.5px] text-rail-icon">{role}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-semibold text-rail-icon transition hover:bg-white/8 hover:text-white"
          >
            <IconLogout width={19} height={19} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </div>
  );
}

export default Rail;
