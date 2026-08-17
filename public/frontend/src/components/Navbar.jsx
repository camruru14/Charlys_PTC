import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Inicio", end: true },
  { to: "/productos", label: "Productos" },
  { to: "/beneficios", label: "Beneficios" },
  { to: "/contacto", label: "Contacto" },
];

export default function Navbar() {
  const { count } = useCart();
  const { customer } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
        >
          <span className="inline-block h-3 w-3 rounded-full bg-primary" />
          Industrias Charly
        </Link>

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
          <Link
            to="/carrito"
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
    </header>
  );
}
