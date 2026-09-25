import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS, BOTTOM_ITEMS } from "../lib/nav";
import { IconClose, IconLogout } from "../lib/icons";
import { useAuth } from "../hooks/useAuth";

/*
  Navegación del panel.
  - >= 1024px: riel de íconos de 68px (Rail).
  - <  1024px: cajón deslizable con etiquetas (Drawer), que abre el botón de
    menú del PageHeader.
*/

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
      aria-label={label}
      className={({ isActive }) =>
        `flex h-10 w-10 items-center justify-center rounded-[12px] transition ${
          isActive ? "bg-rail-active text-white" : "text-rail-icon hover:bg-white/8 hover:text-white"
        }`
      }
    >
      <Icon width={19} height={19} strokeWidth={1.8} />
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={name}
        aria-label={`Cuenta de ${name}`}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-rail-active text-[12.5px] font-bold text-white transition hover:ring-2 hover:ring-white/20"
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-[12px] border border-line bg-surface p-1.5 shadow-modal">
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col items-center gap-1.5 bg-rail py-[22px] lg:flex">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-[13px] font-extrabold text-white">
        IC
      </span>
      <span className="my-2 h-px w-[26px] bg-white/16" />
      <nav className="flex flex-col items-center gap-1.5" aria-label="Módulos">
        {NAV_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        {BOTTOM_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
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
