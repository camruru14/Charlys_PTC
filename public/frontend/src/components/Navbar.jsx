import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Inicio", end: true },
  { to: "/productos", label: "Productos" },
  { to: "/beneficios", label: "Beneficios" },
  { to: "/contacto", label: "Contacto" },
];

// Ítems de cuenta del menú móvil (Perfil/Mis pedidos/Login/Registro), mismo
// contenido condicional que ya muestra el bloque `sm:flex` de escritorio,
// solo que apilados como lista en vez de una fila.
function mobileAccountLinks(customer) {
  if (customer) {
    return [
      { to: "/cuenta/pedidos", label: "Mis pedidos" },
      { to: "/cuenta/perfil", label: "Perfil" },
    ];
  }
  return [
    { to: "/cuenta/login", label: "Iniciar sesión" },
    { to: "/cuenta/registro", label: "Crear cuenta", accent: true },
  ];
}

export default function Navbar() {
  const { count } = useCart();
  const { customer } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-1">
          {/* Botón hamburguesa: solo en móvil/tablet, junto al logo */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition hover:bg-secondary md:hidden"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>

          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          >
            <span className="inline-block h-3 w-3 rounded-full bg-primary" />
            Industrias Charly
          </Link>
        </div>

        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "text-foreground" : "hover:text-foreground"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {customer ? (
            <div className="hidden items-center gap-4 text-sm sm:flex">
              <Link to="/cuenta/pedidos" className="text-muted-foreground hover:text-foreground">
                Mis pedidos
              </Link>
              <Link
                to="/cuenta/perfil"
                aria-label="Perfil"
                title={`Perfil de ${customer.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground transition hover:bg-secondary/70"
              >
                {customer.name?.charAt(0).toUpperCase()}
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-3 text-sm sm:flex">
              <Link to="/cuenta/login" className="text-muted-foreground hover:text-foreground">
                Iniciar sesión
              </Link>
              <Link
                to="/cuenta/registro"
                className="font-medium text-primary hover:underline"
              >
                Crear cuenta
              </Link>
            </div>
          )}
          {/* El carrito siempre queda visible, en escritorio y en móvil. */}
          <Link
            to="/carrito"
            onClick={closeMenu}
            className="relative inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Carrito
            {count > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-xs font-bold text-primary">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Menú móvil: dropdown debajo del header (solo hasta md, donde ya
          aparece la barra de navegación normal). Cada link lo cierra al
          navegar, así nunca queda abierto tapando la página siguiente. */}
      {menuOpen && (
        <nav className="border-t border-border/60 bg-background px-6 py-4 md:hidden">
          <ul className="space-y-1 text-sm">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2.5 font-medium transition ${
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            {mobileAccountLinks(customer).map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={closeMenu}
                  className={`block rounded-lg px-3 py-2.5 font-medium transition hover:bg-secondary ${
                    item.accent ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
